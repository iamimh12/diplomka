package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type SeedHall struct {
	ID   uint
	Name string
	Rows int
	Cols int
}

type SeedMovie struct {
	ID           uint
	DurationMins int `gorm:"column:duration_mins"`
}

type SeedSession struct {
	MovieID   uint      `gorm:"column:movie_id"`
	HallID    uint      `gorm:"column:hall_id"`
	StartTime time.Time `gorm:"column:start_time"`
	BasePrice int       `gorm:"column:base_price"`
}

func main() {
	_ = godotenv.Load()

	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	halls := []SeedHall{
		{Name: "Hall A", Rows: 10, Cols: 14},
		{Name: "Hall B", Rows: 8, Cols: 12},
		{Name: "Hall C", Rows: 7, Cols: 10},
		{Name: "Hall D", Rows: 9, Cols: 12},
		{Name: "Hall E", Rows: 11, Cols: 16},
		{Name: "Hall F", Rows: 6, Cols: 9},
		{Name: "Hall G", Rows: 12, Cols: 18},
		{Name: "Hall H", Rows: 10, Cols: 15},
		{Name: "Hall I", Rows: 8, Cols: 11},
		{Name: "Hall J", Rows: 14, Cols: 20},
	}

	for i := range halls {
		var existing SeedHall
		if err := db.Table("halls").Where("name = ?", halls[i].Name).First(&existing).Error; err == nil {
			halls[i].ID = existing.ID
			continue
		}
		if err := db.Table("halls").Create(&halls[i]).Error; err != nil {
			log.Fatalf("failed to create hall %s: %v", halls[i].Name, err)
		}
	}

	for _, hall := range halls {
		var count int64
		if err := db.Table("seats").Where("hall_id = ?", hall.ID).Count(&count).Error; err != nil {
			log.Fatalf("failed to check seats for hall %d: %v", hall.ID, err)
		}
		if count > 0 {
			continue
		}
		seats := make([]map[string]any, 0, hall.Rows*hall.Cols)
		for r := 1; r <= hall.Rows; r++ {
			for n := 1; n <= hall.Cols; n++ {
				seats = append(seats, map[string]any{
					"hall_id": hall.ID,
					"row":     r,
					"number":  n,
				})
			}
		}
		if err := db.Table("seats").Create(&seats).Error; err != nil {
			log.Fatalf("failed to create seats for hall %d: %v", hall.ID, err)
		}
	}

	var movies []SeedMovie
	if err := db.Table("movies").Select("id", "duration_mins").Order("id asc").Find(&movies).Error; err != nil {
		log.Fatalf("failed to load movies: %v", err)
	}
	if len(movies) == 0 {
		log.Fatal("no movies found")
	}

	now := time.Now()
	location := now.Location()
	newSessions := make([]SeedSession, 0)
	const (
		dayStartHour      = 6
		dayEndHour        = 23
		breakBetweenShows = 20 * time.Minute
	)

	nextMovieIndex := 0
	for day := 0; day < 7; day++ {
		baseDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location).AddDate(0, 0, day)

		dayStart := baseDate.Add(dayStartHour * time.Hour)
		dayEnd := baseDate.Add(dayEndHour * time.Hour)
		hallCursor := make([]time.Time, len(halls))
		for i := range halls {
			// Slight staggering avoids every hall starting at exactly the same minute.
			hallCursor[i] = dayStart.Add(time.Duration(i*10) * time.Minute)
		}

		// Ensure each movie appears at least once per day across all halls.
		for _, movie := range movies {
			hallIndex := earliestAvailableHall(hallCursor)
			startTime := hallCursor[hallIndex]
			if startTime.After(dayEnd) {
				break
			}

			duration := safeDuration(movie.DurationMins)
			var existingCount int64
			if err := db.Table("sessions").
				Where("hall_id = ? AND start_time = ?", halls[hallIndex].ID, startTime).
				Count(&existingCount).Error; err != nil {
				log.Fatalf("failed to check sessions: %v", err)
			}
			if existingCount == 0 {
				newSessions = append(newSessions, SeedSession{
					MovieID:   movie.ID,
					HallID:    halls[hallIndex].ID,
					StartTime: startTime,
					BasePrice: calcBasePrice(startTime, hallIndex),
				})
			}

			hallCursor[hallIndex] = startTime.Add(duration).Add(breakBetweenShows)
		}

		// Fill remaining daily slots up to 23:00 with realistic intervals.
		for {
			hallIndex := earliestAvailableHall(hallCursor)
			startTime := hallCursor[hallIndex]
			if startTime.After(dayEnd) {
				break
			}

			movie := movies[nextMovieIndex%len(movies)]
			nextMovieIndex++
			duration := safeDuration(movie.DurationMins)

			var existingCount int64
			if err := db.Table("sessions").
				Where("hall_id = ? AND start_time = ?", halls[hallIndex].ID, startTime).
				Count(&existingCount).Error; err != nil {
				log.Fatalf("failed to check sessions: %v", err)
			}
			if existingCount == 0 {
				newSessions = append(newSessions, SeedSession{
					MovieID:   movie.ID,
					HallID:    halls[hallIndex].ID,
					StartTime: startTime,
					BasePrice: calcBasePrice(startTime, hallIndex),
				})
			}

			hallCursor[hallIndex] = startTime.Add(duration).Add(breakBetweenShows)
		}
	}

	if len(newSessions) == 0 {
		fmt.Println("No new sessions to add.")
		return
	}

	if err := db.Table("sessions").Create(&newSessions).Error; err != nil {
		log.Fatalf("failed to create sessions: %v", err)
	}

	fmt.Printf("Added %d sessions across %d halls.\n", len(newSessions), len(halls))
}

func safeDuration(minutes int) time.Duration {
	if minutes <= 0 {
		minutes = 100
	}
	return time.Duration(minutes) * time.Minute
}

func earliestAvailableHall(cursor []time.Time) int {
	minIndex := 0
	for i := 1; i < len(cursor); i++ {
		if cursor[i].Before(cursor[minIndex]) {
			minIndex = i
		}
	}
	return minIndex
}

func calcBasePrice(start time.Time, hallIndex int) int {
	price := 420 + hallIndex*20
	hour := start.Hour()
	if hour >= 18 {
		price += 120
	} else if hour >= 12 {
		price += 60
	}
	if hour < 9 {
		price -= 40
	}
	if price < 300 {
		price = 300
	}
	return price
}
