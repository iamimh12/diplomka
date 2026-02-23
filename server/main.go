
package main

import (
    "bytes"
    "errors"
    "fmt"
    "net/http"
    "os"
    "path/filepath"
    "strconv"
    "strings"
    "time"

    "github.com/gin-contrib/cors"
    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
    "github.com/jung-kurt/gofpdf"
    "github.com/joho/godotenv"
    "github.com/skip2/go-qrcode"
    "go.uber.org/zap"
    "golang.org/x/crypto/bcrypt"
    "gorm.io/driver/postgres"
    "gorm.io/gorm"
    "gorm.io/gorm/clause"
)

type Config struct {
    DatabaseURL   string
    JwtSecret     string
    Port          string
    CorsOrigin    string
    Seed          bool
    AdminEmail    string
    AdminPassword string
    AdminName     string
}

type User struct {
    ID           uint      `gorm:"primaryKey" json:"id"`
    Name         string    `json:"name"`
    Email        string    `gorm:"uniqueIndex" json:"email"`
    PasswordHash string    `json:"-"`
    IsAdmin      bool      `json:"is_admin"`
    AvatarURL    string    `json:"avatar_url"`
    CreatedAt    time.Time `json:"created_at"`
}

type Movie struct {
    ID           uint      `gorm:"primaryKey" json:"id"`
    Title        string    `json:"title"`
    TitleEN      string    `json:"title_en"`
    TitleKK      string    `json:"title_kk"`
    Description  string    `json:"description"`
    DescriptionEN string   `json:"description_en"`
    DescriptionKK string   `json:"description_kk"`
    DurationMins int       `json:"duration_mins"`
    PosterURL    string    `json:"poster_url"`
    Country      string    `json:"country"`
    CountryEN    string    `json:"country_en"`
    CountryKK    string    `json:"country_kk"`
    Genres       string    `json:"genres"`
    GenresEN     string    `json:"genres_en"`
    GenresKK     string    `json:"genres_kk"`
    ReleaseYear  int       `json:"release_year"`
    CreatedAt    time.Time `json:"created_at"`
}

type Hall struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    Name      string    `json:"name"`
    Rows      int       `json:"rows"`
    Cols      int       `json:"cols"`
    CreatedAt time.Time `json:"created_at"`
}

type Seat struct {
    ID     uint `gorm:"primaryKey" json:"id"`
    HallID uint `json:"hall_id"`
    Row    int  `json:"row"`
    Number int  `json:"number"`
}

type Session struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    MovieID   uint      `json:"movie_id"`
    HallID    uint      `json:"hall_id"`
    StartTime time.Time `json:"start_time"`
    BasePrice int       `json:"base_price"`
    Movie     Movie     `json:"movie"`
    Hall      Hall      `json:"hall"`
}

type Booking struct {
    ID         uint      `gorm:"primaryKey" json:"id"`
    UserID     uint      `json:"user_id"`
    SessionID  uint      `json:"session_id"`
    Status     string    `json:"status"`
    TotalPrice int       `json:"total_price"`
    PaymentMethod string `json:"payment_method"`
    CreatedAt  time.Time `json:"created_at"`
    Session    Session   `json:"session"`
    Seats      []Seat    `gorm:"many2many:booking_seats" json:"seats"`
}

type BookingSeat struct {
    BookingID uint `gorm:"primaryKey"`
    SeatID    uint `gorm:"primaryKey"`
}

type RegisterRequest struct {
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
}

type LoginRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

type UpdateProfileRequest struct {
    Name string `json:"name"`
}

type ChangePasswordRequest struct {
    CurrentPassword string `json:"current_password"`
    NewPassword     string `json:"new_password"`
}

type BookingRequest struct {
    SessionID uint   `json:"session_id"`
    SeatIDs   []uint `json:"seat_ids"`
    PaymentMethod string `json:"payment_method"`
}

type BookingStatusRequest struct {
    Status string `json:"status"`
}

type MovieRequest struct {
    Title        string `json:"title"`
    TitleEN      string `json:"title_en"`
    TitleKK      string `json:"title_kk"`
    Description  string `json:"description"`
    DescriptionEN string `json:"description_en"`
    DescriptionKK string `json:"description_kk"`
    DurationMins int    `json:"duration_mins"`
    PosterURL    string `json:"poster_url"`
    Country      string `json:"country"`
    CountryEN    string `json:"country_en"`
    CountryKK    string `json:"country_kk"`
    Genres       string `json:"genres"`
    GenresEN     string `json:"genres_en"`
    GenresKK     string `json:"genres_kk"`
    ReleaseYear  int    `json:"release_year"`
}

type HallRequest struct {
    Name string `json:"name"`
    Rows int    `json:"rows"`
    Cols int    `json:"cols"`
}

type SessionRequest struct {
    MovieID   uint   `json:"movie_id"`
    HallID    uint   `json:"hall_id"`
    StartTime string `json:"start_time"`
    BasePrice int    `json:"base_price"`
}

type Claims struct {
    UserID uint `json:"user_id"`
    jwt.RegisteredClaims
}

func main() {
    _ = godotenv.Load()
    cfg := loadConfig()

    logger, _ := zap.NewProduction()
    defer logger.Sync()

    if cfg.DatabaseURL == "" {
        logger.Fatal("DATABASE_URL is required")
    }
    if cfg.JwtSecret == "" {
        logger.Fatal("JWT_SECRET is required")
    }

    db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
    if err != nil {
        logger.Fatal("failed to connect to database", zap.Error(err))
    }

    if err := db.AutoMigrate(&User{}, &Movie{}, &Hall{}, &Seat{}, &Session{}, &Booking{}, &BookingSeat{}); err != nil {
        logger.Fatal("failed to migrate database", zap.Error(err))
    }

    if err := seedAdmin(db, cfg); err != nil {
        logger.Fatal("failed to seed admin", zap.Error(err))
    }

    if cfg.Seed {
        if err := seedData(db); err != nil {
            logger.Fatal("failed to seed data", zap.Error(err))
        }
    }

    gin.SetMode(gin.ReleaseMode)
    router := gin.New()
    router.Use(gin.Recovery())
    router.Use(ginLogger(logger))
    allowOrigins := parseOrigins(cfg.CorsOrigin)
    allowCredentials := true
    if strings.TrimSpace(cfg.CorsOrigin) == "*" {
        allowOrigins = []string{"*"}
        allowCredentials = false
    }
    router.Use(cors.New(cors.Config{
        AllowOrigins:     allowOrigins,
        AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Authorization", "Content-Type"},
        AllowCredentials: allowCredentials,
        MaxAge:           12 * time.Hour,
    }))

    api := router.Group("/api")
    {
        api.POST("/auth/register", registerHandler(db, cfg.JwtSecret))
        api.POST("/auth/login", loginHandler(db, cfg.JwtSecret))
        api.GET("/me", authMiddleware(cfg.JwtSecret), meHandler(db))
        api.PATCH("/me", authMiddleware(cfg.JwtSecret), updateMeHandler(db))
        api.PATCH("/me/password", authMiddleware(cfg.JwtSecret), changePasswordHandler(db))
        api.POST("/me/avatar", authMiddleware(cfg.JwtSecret), uploadAvatarHandler(db))

        api.GET("/movies", listMovies(db))
        api.GET("/movies/:id", getMovie(db))

        api.GET("/sessions", listSessions(db))
        api.GET("/sessions/:id", getSession(db))
        api.GET("/sessions/:id/availability", sessionAvailability(db))

        api.GET("/halls", listHalls(db))
        api.GET("/halls/:id/seats", listSeats(db))

        api.POST("/bookings", authMiddleware(cfg.JwtSecret), createBooking(db))
        api.GET("/bookings/mine", authMiddleware(cfg.JwtSecret), listMyBookings(db))
        api.PATCH("/bookings/:id/cancel", authMiddleware(cfg.JwtSecret), cancelBooking(db))
        api.GET("/bookings/:id/qr", authMiddleware(cfg.JwtSecret), bookingQR(db))
        api.GET("/bookings/:id/ticket", authMiddleware(cfg.JwtSecret), bookingTicket(db))
    }

    admin := router.Group("/api/admin")
    admin.Use(authMiddleware(cfg.JwtSecret), adminMiddleware(db))
    {
        admin.POST("/movies", createMovie(db))
        admin.PUT("/movies/:id", updateMovie(db))
        admin.DELETE("/movies/:id", deleteMovie(db))

        admin.POST("/halls", createHall(db))
        admin.PUT("/halls/:id", updateHall(db))
        admin.DELETE("/halls/:id", deleteHall(db))

        admin.POST("/sessions", createSession(db))
        admin.PUT("/sessions/:id", updateSession(db))
        admin.DELETE("/sessions/:id", deleteSession(db))

        admin.PATCH("/bookings/:id/status", updateBookingStatus(db))
    }

    port := cfg.Port
    if port == "" {
        port = "8080"
    }

    router.Static("/uploads", "./uploads")

    logger.Info("server starting", zap.String("port", port))
    if err := router.Run("0.0.0.0:" + port); err != nil {
        logger.Fatal("server stopped", zap.Error(err))
    }
}

func loadConfig() Config {
    seed := strings.ToLower(os.Getenv("SEED"))
    return Config{
        DatabaseURL:   os.Getenv("DATABASE_URL"),
        JwtSecret:     os.Getenv("JWT_SECRET"),
        Port:          os.Getenv("PORT"),
        CorsOrigin:    os.Getenv("CORS_ORIGIN"),
        Seed:          seed == "true" || seed == "1" || seed == "yes",
        AdminEmail:    os.Getenv("ADMIN_EMAIL"),
        AdminPassword: os.Getenv("ADMIN_PASSWORD"),
        AdminName:     os.Getenv("ADMIN_NAME"),
    }
}

func parseOrigins(raw string) []string {
    if raw == "" {
        return []string{"http://localhost:5173", "http://127.0.0.1:5173"}
    }
    parts := strings.Split(raw, ",")
    origins := make([]string, 0, len(parts))
    for _, part := range parts {
        trimmed := strings.TrimSpace(part)
        if trimmed != "" {
            origins = append(origins, trimmed)
        }
    }
    if len(origins) == 0 {
        origins = append(origins, "http://localhost:5173")
    }
    return origins
}

func ginLogger(logger *zap.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()
        latency := time.Since(start)
        logger.Info("request",
            zap.String("method", c.Request.Method),
            zap.String("path", c.Request.URL.Path),
            zap.Int("status", c.Writer.Status()),
            zap.Duration("latency", latency),
            zap.String("ip", c.ClientIP()),
        )
    }
}
func registerHandler(db *gorm.DB, secret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req RegisterRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
            return
        }
        req.Email = strings.TrimSpace(strings.ToLower(req.Email))
        req.Name = strings.TrimSpace(req.Name)
        if req.Email == "" || req.Password == "" || req.Name == "" {
            c.JSON(http.StatusBadRequest, gin.H{"error": "name, email, password are required"})
            return
        }
        if len(req.Password) < 6 {
            c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 6 characters"})
            return
        }

        hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
            return
        }

        user := User{Name: req.Name, Email: req.Email, PasswordHash: string(hash), IsAdmin: false}
        if err := db.Create(&user).Error; err != nil {
            c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
            return
        }

        token, err := createToken(user.ID, secret)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create token"})
            return
        }

        c.JSON(http.StatusCreated, gin.H{"token": token, "user": user})
    }
}

func loginHandler(db *gorm.DB, secret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req LoginRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
            return
        }
        req.Email = strings.TrimSpace(strings.ToLower(req.Email))
        if req.Email == "" || req.Password == "" {
            c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
            return
        }

        var user User
        if err := db.Where("email = ?", req.Email).First(&user).Error; err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
            return
        }
        if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
            return
        }

        token, err := createToken(user.ID, secret)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create token"})
            return
        }

        c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
    }
}

func createToken(userID uint, secret string) (string, error) {
    claims := Claims{
        UserID: userID,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
        },
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(secret))
}

func authMiddleware(secret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if !strings.HasPrefix(authHeader, "Bearer ") {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
            return
        }
        tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
        token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
            if token.Method != jwt.SigningMethodHS256 {
                return nil, errors.New("unexpected signing method")
            }
            return []byte(secret), nil
        })
        if err != nil || !token.Valid {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
            return
        }
        claims, ok := token.Claims.(*Claims)
        if !ok {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
            return
        }
        c.Set("user_id", claims.UserID)
        c.Next()
    }
}

func adminMiddleware(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("user_id")
        var user User
        if err := db.First(&user, userID).Error; err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
            return
        }
        if !user.IsAdmin {
            c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
            return
        }
        c.Next()
    }
}

func meHandler(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("user_id")
        var user User
        if err := db.First(&user, userID).Error; err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
            return
        }
        c.JSON(http.StatusOK, user)
    }
}

func updateMeHandler(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req UpdateProfileRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
            return
        }
        name := strings.TrimSpace(req.Name)
        if name == "" {
            c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
            return
        }

        userID := c.GetUint("user_id")
        if err := db.Model(&User{}).Where("id = ?", userID).Update("name", name).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update profile"})
            return
        }

        var user User
        if err := db.First(&user, userID).Error; err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
            return
        }
        c.JSON(http.StatusOK, user)
    }
}

func changePasswordHandler(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req ChangePasswordRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
            return
        }
        currentPassword := strings.TrimSpace(req.CurrentPassword)
        newPassword := strings.TrimSpace(req.NewPassword)
        if currentPassword == "" || newPassword == "" {
            c.JSON(http.StatusBadRequest, gin.H{"error": "current and new password are required"})
            return
        }
        if len(newPassword) < 6 {
            c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 6 characters"})
            return
        }

        userID := c.GetUint("user_id")
        var user User
        if err := db.First(&user, userID).Error; err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
            return
        }
        if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
            return
        }

        hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
            return
        }
        if err := db.Model(&User{}).Where("id = ?", userID).Update("password_hash", string(hash)).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
            return
        }

        c.JSON(http.StatusOK, gin.H{"status": "ok"})
    }
}

func uploadAvatarHandler(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("user_id")
        file, err := c.FormFile("avatar")
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "avatar file is required"})
            return
        }

        ext := strings.ToLower(filepath.Ext(file.Filename))
        switch ext {
        case ".jpg", ".jpeg", ".png", ".webp":
        default:
            c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type"})
            return
        }

        uploadDir := filepath.Join("uploads", "avatars")
        if err := os.MkdirAll(uploadDir, 0755); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store avatar"})
            return
        }

        filename := fmt.Sprintf("u%d-%d%s", userID, time.Now().UnixNano(), ext)
        target := filepath.Join(uploadDir, filename)
        if err := c.SaveUploadedFile(file, target); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store avatar"})
            return
        }

        avatarURL := "/" + filepath.ToSlash(target)
        if err := db.Model(&User{}).Where("id = ?", userID).Update("avatar_url", avatarURL).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update avatar"})
            return
        }

        var user User
        if err := db.First(&user, userID).Error; err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
            return
        }
        c.JSON(http.StatusOK, user)
    }
}

func listMovies(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        var movies []Movie
        if err := db.Order("created_at desc").Find(&movies).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load movies"})
            return
        }
        c.JSON(http.StatusOK, movies)
    }
}

func getMovie(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")
        var movie Movie
        if err := db.First(&movie, id).Error; err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "movie not found"})
            return
        }
        c.JSON(http.StatusOK, movie)
    }
}

func createMovie(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req MovieRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
            return
        }
        if strings.TrimSpace(req.Title) == "" || req.DurationMins <= 0 {
            c.JSON(http.StatusBadRequest, gin.H{"error": "title and duration_mins are required"})
            return
        }
        movie := Movie{
            Title:        strings.TrimSpace(req.Title),
            TitleEN:      strings.TrimSpace(req.TitleEN),
            TitleKK:      strings.TrimSpace(req.TitleKK),
            Description:  strings.TrimSpace(req.Description),
            DescriptionEN: strings.TrimSpace(req.DescriptionEN),
            DescriptionKK: strings.TrimSpace(req.DescriptionKK),
            DurationMins: req.DurationMins,
            PosterURL:    strings.TrimSpace(req.PosterURL),
            Country:      strings.TrimSpace(req.Country),
            CountryEN:    strings.TrimSpace(req.CountryEN),
            CountryKK:    strings.TrimSpace(req.CountryKK),
            Genres:       strings.TrimSpace(req.Genres),
            GenresEN:     strings.TrimSpace(req.GenresEN),
            GenresKK:     strings.TrimSpace(req.GenresKK),
            ReleaseYear:  req.ReleaseYear,
        }
        if err := db.Create(&movie).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create movie"})
            return
        }
        c.JSON(http.StatusCreated, movie)
    }
}

func updateMovie(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")
        var req MovieRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
            return
        }
        updates := map[string]interface{}{}
        if strings.TrimSpace(req.Title) != "" {
            updates["title"] = strings.TrimSpace(req.Title)
        }
        if strings.TrimSpace(req.TitleEN) != "" {
            updates["title_en"] = strings.TrimSpace(req.TitleEN)
        }
        if strings.TrimSpace(req.TitleKK) != "" {
            updates["title_kk"] = strings.TrimSpace(req.TitleKK)
        }
        if req.Description != "" {
            updates["description"] = strings.TrimSpace(req.Description)
        }
        if req.DescriptionEN != "" {
            updates["description_en"] = strings.TrimSpace(req.DescriptionEN)
        }
        if req.DescriptionKK != "" {
            updates["description_kk"] = strings.TrimSpace(req.DescriptionKK)
        }
        if req.DurationMins > 0 {
            updates["duration_mins"] = req.DurationMins
        }
        if req.PosterURL != "" {
            updates["poster_url"] = strings.TrimSpace(req.PosterURL)
        }
        if req.Country != "" {
            updates["country"] = strings.TrimSpace(req.Country)
        }
        if req.CountryEN != "" {
            updates["country_en"] = strings.TrimSpace(req.CountryEN)
        }
        if req.CountryKK != "" {
            updates["country_kk"] = strings.TrimSpace(req.CountryKK)
        }
        if req.Genres != "" {
            updates["genres"] = strings.TrimSpace(req.Genres)
        }
        if req.GenresEN != "" {
            updates["genres_en"] = strings.TrimSpace(req.GenresEN)
        }
        if req.GenresKK != "" {
            updates["genres_kk"] = strings.TrimSpace(req.GenresKK)
        }
        if req.ReleaseYear > 0 {
            updates["release_year"] = req.ReleaseYear
        }
        if len(updates) == 0 {
            c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
            return
        }
        if err := db.Model(&Movie{}).Where("id = ?", id).Updates(updates).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update movie"})
            return
        }
        var movie Movie
        if err := db.First(&movie, id).Error; err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "movie not found"})
            return
        }
        c.JSON(http.StatusOK, movie)
    }
}

func deleteMovie(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")
        var count int64
        if err := db.Model(&Session{}).Where("movie_id = ?", id).Count(&count).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check sessions"})
            return
        }
        if count > 0 {
            c.JSON(http.StatusConflict, gin.H{"error": "movie has sessions"})
            return
        }
        if err := db.Delete(&Movie{}, id).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete movie"})
            return
        }
        c.Status(http.StatusNoContent)
    }
}

func listHalls(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        var halls []Hall
        if err := db.Order("created_at desc").Find(&halls).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load halls"})
            return
        }
        c.JSON(http.StatusOK, halls)
    }
}

func createHall(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req HallRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
            return
        }
        if strings.TrimSpace(req.Name) == "" || req.Rows <= 0 || req.Cols <= 0 {
            c.JSON(http.StatusBadRequest, gin.H{"error": "name, rows, cols are required"})
            return
        }

        hall := Hall{Name: strings.TrimSpace(req.Name), Rows: req.Rows, Cols: req.Cols}
        err := db.Transaction(func(tx *gorm.DB) error {
            if err := tx.Create(&hall).Error; err != nil {
                return err
            }
            seats := make([]Seat, 0, hall.Rows*hall.Cols)
            for r := 1; r <= hall.Rows; r++ {
                for n := 1; n <= hall.Cols; n++ {
                    seats = append(seats, Seat{HallID: hall.ID, Row: r, Number: n})
                }
            }
            if err := tx.Create(&seats).Error; err != nil {
                return err
            }
            return nil
        })
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create hall"})
            return
        }

        c.JSON(http.StatusCreated, hall)
    }
}

func updateHall(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")
        var req HallRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
            return
        }
        if strings.TrimSpace(req.Name) == "" {
            c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
            return
        }
        if err := db.Model(&Hall{}).Where("id = ?", id).Update("name", strings.TrimSpace(req.Name)).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update hall"})
            return
        }
        var hall Hall
        if err := db.First(&hall, id).Error; err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "hall not found"})
            return
        }
        c.JSON(http.StatusOK, hall)
    }
}

func deleteHall(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")
        var count int64
        if err := db.Model(&Session{}).Where("hall_id = ?", id).Count(&count).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check sessions"})
            return
        }
        if count > 0 {
            c.JSON(http.StatusConflict, gin.H{"error": "hall has sessions"})
            return
        }
        err := db.Transaction(func(tx *gorm.DB) error {
            if err := tx.Where("hall_id = ?", id).Delete(&Seat{}).Error; err != nil {
                return err
            }
            if err := tx.Delete(&Hall{}, id).Error; err != nil {
                return err
            }
            return nil
        })
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete hall"})
            return
        }
        c.Status(http.StatusNoContent)
    }
}
func listSessions(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        var sessions []Session
        query := db.Preload("Movie").Preload("Hall").Order("start_time asc")
        if movieID := c.Query("movie_id"); movieID != "" {
            if _, err := strconv.Atoi(movieID); err == nil {
                query = query.Where("movie_id = ?", movieID)
            }
        }
        if err := query.Find(&sessions).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load sessions"})
            return
        }
        c.JSON(http.StatusOK, sessions)
    }
}

func getSession(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")
        var session Session
        if err := db.Preload("Movie").Preload("Hall").First(&session, id).Error; err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
            return
        }
        c.JSON(http.StatusOK, session)
    }
}

func createSession(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req SessionRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
            return
        }
        startTime, err := time.Parse(time.RFC3339, req.StartTime)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "start_time must be RFC3339"})
            return
        }
        if req.MovieID == 0 || req.HallID == 0 || req.BasePrice <= 0 {
            c.JSON(http.StatusBadRequest, gin.H{"error": "movie_id, hall_id, base_price are required"})
            return
        }
        session := Session{MovieID: req.MovieID, HallID: req.HallID, StartTime: startTime, BasePrice: req.BasePrice}
        if err := db.Create(&session).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session"})
            return
        }
        if err := db.Preload("Movie").Preload("Hall").First(&session, session.ID).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load session"})
            return
        }
        c.JSON(http.StatusCreated, session)
    }
}

func updateSession(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")
        var req SessionRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
            return
        }
        updates := map[string]interface{}{}
        if req.MovieID > 0 {
            updates["movie_id"] = req.MovieID
        }
        if req.HallID > 0 {
            updates["hall_id"] = req.HallID
        }
        if req.BasePrice > 0 {
            updates["base_price"] = req.BasePrice
        }
        if req.StartTime != "" {
            startTime, err := time.Parse(time.RFC3339, req.StartTime)
            if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "start_time must be RFC3339"})
                return
            }
            updates["start_time"] = startTime
        }
        if len(updates) == 0 {
            c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
            return
        }
        if err := db.Model(&Session{}).Where("id = ?", id).Updates(updates).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update session"})
            return
        }
        var session Session
        if err := db.Preload("Movie").Preload("Hall").First(&session, id).Error; err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
            return
        }
        c.JSON(http.StatusOK, session)
    }
}

func deleteSession(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")
        var count int64
        if err := db.Model(&Booking{}).Where("session_id = ? AND status = ?", id, "confirmed").Count(&count).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check bookings"})
            return
        }
        if count > 0 {
            c.JSON(http.StatusConflict, gin.H{"error": "session has bookings"})
            return
        }
        if err := db.Delete(&Session{}, id).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete session"})
            return
        }
        c.Status(http.StatusNoContent)
    }
}

func listSeats(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")
        var seats []Seat
        if err := db.Where("hall_id = ?", id).Order("row asc, number asc").Find(&seats).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load seats"})
            return
        }
        c.JSON(http.StatusOK, seats)
    }
}

func sessionAvailability(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")
        var bookingSeats []BookingSeat
        if err := db.Table("booking_seats").
            Joins("JOIN bookings ON bookings.id = booking_seats.booking_id").
            Where("bookings.session_id = ? AND bookings.status = ?", id, "confirmed").
            Find(&bookingSeats).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load availability"})
            return
        }
        seatIDs := make([]uint, 0, len(bookingSeats))
        for _, bs := range bookingSeats {
            seatIDs = append(seatIDs, bs.SeatID)
        }
        c.JSON(http.StatusOK, gin.H{"booked_seat_ids": seatIDs})
    }
}

func createBooking(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("user_id")
        var req BookingRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
            return
        }
        if req.SessionID == 0 || len(req.SeatIDs) == 0 || strings.TrimSpace(req.PaymentMethod) == "" {
            c.JSON(http.StatusBadRequest, gin.H{"error": "session_id, seat_ids, payment_method are required"})
            return
        }

        var session Session
        if err := db.Preload("Hall").First(&session, req.SessionID).Error; err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
            return
        }

        var seats []Seat
        if err := db.Where("hall_id = ? AND id IN ?", session.HallID, req.SeatIDs).Find(&seats).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate seats"})
            return
        }
        if len(seats) != len(req.SeatIDs) {
            c.JSON(http.StatusBadRequest, gin.H{"error": "some seats are invalid for this hall"})
            return
        }

        var booking Booking
        err := db.Transaction(func(tx *gorm.DB) error {
            var booked []uint
            if err := tx.Table("booking_seats").
                Select("booking_seats.seat_id").
                Joins("JOIN bookings ON bookings.id = booking_seats.booking_id").
                Where("bookings.session_id = ? AND bookings.status = ? AND booking_seats.seat_id IN ?", session.ID, "confirmed", req.SeatIDs).
                Find(&booked).Error; err != nil {
                return err
            }
            if len(booked) > 0 {
                return fmt.Errorf("seats already booked")
            }

            booking = Booking{
                UserID:     userID,
                SessionID:  session.ID,
                Status:     "confirmed",
                TotalPrice: session.BasePrice * len(req.SeatIDs),
                PaymentMethod: strings.TrimSpace(req.PaymentMethod),
            }
            if err := tx.Create(&booking).Error; err != nil {
                return err
            }

            bookingSeats := make([]BookingSeat, 0, len(req.SeatIDs))
            for _, seatID := range req.SeatIDs {
                bookingSeats = append(bookingSeats, BookingSeat{BookingID: booking.ID, SeatID: seatID})
            }
            if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&bookingSeats).Error; err != nil {
                return err
            }
            return nil
        })
        if err != nil {
            c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
            return
        }

        if err := db.Preload("Session.Movie").Preload("Session.Hall").Preload("Seats").First(&booking, booking.ID).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load booking"})
            return
        }
        c.JSON(http.StatusCreated, booking)
    }
}

func listMyBookings(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("user_id")
        var bookings []Booking
        if err := db.Preload("Session.Movie").Preload("Session.Hall").Preload("Seats").
            Where("user_id = ?", userID).Order("created_at desc").Find(&bookings).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load bookings"})
            return
        }
        c.JSON(http.StatusOK, bookings)
    }
}

func cancelBooking(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("user_id")
        id := c.Param("id")
        var booking Booking
        if err := db.Where("id = ? AND user_id = ?", id, userID).First(&booking).Error; err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "booking not found"})
            return
        }
        if booking.Status == "cancelled" {
            c.JSON(http.StatusBadRequest, gin.H{"error": "booking already cancelled"})
            return
        }
        if err := db.Model(&booking).Update("status", "cancelled").Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to cancel booking"})
            return
        }
        if err := db.Preload("Session.Movie").Preload("Session.Hall").Preload("Seats").First(&booking, booking.ID).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load booking"})
            return
        }
        c.JSON(http.StatusOK, booking)
    }
}

func updateBookingStatus(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")
        var req BookingStatusRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
            return
        }
        status := strings.ToLower(strings.TrimSpace(req.Status))
        if status != "confirmed" && status != "cancelled" {
            c.JSON(http.StatusBadRequest, gin.H{"error": "status must be confirmed or cancelled"})
            return
        }
        if err := db.Model(&Booking{}).Where("id = ?", id).Update("status", status).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update booking"})
            return
        }
        var booking Booking
        if err := db.Preload("Session.Movie").Preload("Session.Hall").Preload("Seats").First(&booking, id).Error; err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "booking not found"})
            return
        }
        c.JSON(http.StatusOK, booking)
    }
}

func bookingQR(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        booking, err := loadBookingForUser(db, c)
        if err != nil {
            return
        }
        payload := fmt.Sprintf("booking:%d|session:%d|status:%s", booking.ID, booking.SessionID, booking.Status)
        png, err := qrcode.Encode(payload, qrcode.Medium, 256)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate qr"})
            return
        }
        c.Header("Content-Type", "image/png")
        c.Writer.Write(png)
    }
}

func bookingTicket(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        booking, err := loadBookingForUser(db, c)
        if err != nil {
            return
        }
        pdf := gofpdf.New("P", "mm", "A4", "")
        pdf.SetMargins(20, 20, 20)
        pdf.AddPage()
        pdf.SetFont("Helvetica", "B", 20)
        pdf.Cell(0, 12, "Kinoform Ticket")
        pdf.Ln(14)
        pdf.SetFont("Helvetica", "", 12)

        movieTitle := sanitizeASCII(booking.Session.Movie.Title)
        hallName := sanitizeASCII(booking.Session.Hall.Name)
        start := booking.Session.StartTime.Format("2006-01-02 15:04")
        seats := formatSeatList(booking.Seats)

        pdf.Cell(0, 8, fmt.Sprintf("Booking: #%d", booking.ID))
        pdf.Ln(8)
        pdf.Cell(0, 8, fmt.Sprintf("Movie: %s", movieTitle))
        pdf.Ln(8)
        pdf.Cell(0, 8, fmt.Sprintf("Hall: %s", hallName))
        pdf.Ln(8)
        pdf.Cell(0, 8, fmt.Sprintf("Start: %s", start))
        pdf.Ln(8)
        pdf.Cell(0, 8, fmt.Sprintf("Seats: %s", seats))
        pdf.Ln(8)
        pdf.Cell(0, 8, fmt.Sprintf("Status: %s", booking.Status))
        pdf.Ln(12)

        qrPayload := fmt.Sprintf("booking:%d|session:%d|status:%s", booking.ID, booking.SessionID, booking.Status)
        qr, err := qrcode.Encode(qrPayload, qrcode.Medium, 200)
        if err == nil {
            opts := gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}
            pdf.RegisterImageOptionsReader("qr", opts, bytes.NewReader(qr))
            pdf.ImageOptions("qr", 20, pdf.GetY(), 40, 40, false, opts, 0, "")
        }

        var buf bytes.Buffer
        if err := pdf.Output(&buf); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to render pdf"})
            return
        }
        c.Header("Content-Type", "application/pdf")
        c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=booking-%d.pdf", booking.ID))
        c.Writer.Write(buf.Bytes())
    }
}
func loadBookingForUser(db *gorm.DB, c *gin.Context) (Booking, error) {
    userID := c.GetUint("user_id")
    id := c.Param("id")
    var booking Booking
    if err := db.Preload("Session.Movie").Preload("Session.Hall").Preload("Seats").First(&booking, id).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "booking not found"})
        return booking, err
    }
    var user User
    if err := db.First(&user, userID).Error; err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
        return booking, err
    }
    if booking.UserID != userID && !user.IsAdmin {
        c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
        return booking, fmt.Errorf("access denied")
    }
    return booking, nil
}

func formatSeatList(seats []Seat) string {
    if len(seats) == 0 {
        return "-"
    }
    labels := make([]string, 0, len(seats))
    for _, seat := range seats {
        labels = append(labels, fmt.Sprintf("R%d-S%d", seat.Row, seat.Number))
    }
    return strings.Join(labels, ", ")
}

func sanitizeASCII(input string) string {
    b := make([]rune, 0, len(input))
    for _, r := range input {
        if r >= 32 && r <= 126 {
            b = append(b, r)
        } else {
            b = append(b, '?')
        }
    }
    if len(b) == 0 {
        return "-"
    }
    return string(b)
}

func seedAdmin(db *gorm.DB, cfg Config) error {
    email := strings.TrimSpace(strings.ToLower(cfg.AdminEmail))
    password := strings.TrimSpace(cfg.AdminPassword)
    if email == "" || password == "" {
        return nil
    }
    var existing User
    if err := db.Where("email = ?", email).First(&existing).Error; err == nil {
        if !existing.IsAdmin {
            return db.Model(&existing).Update("is_admin", true).Error
        }
        return nil
    }
    name := strings.TrimSpace(cfg.AdminName)
    if name == "" {
        name = "Admin"
    }
    hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    if err != nil {
        return err
    }
    admin := User{Name: name, Email: email, PasswordHash: string(hash), IsAdmin: true}
    return db.Create(&admin).Error
}

func seedData(db *gorm.DB) error {
    var count int64
    if err := db.Model(&Movie{}).Count(&count).Error; err != nil {
        return err
    }
    if count > 0 {
        return nil
    }

    halls := []Hall{
        {Name: "Зал А", Rows: 8, Cols: 12},
        {Name: "Зал B", Rows: 10, Cols: 14},
        {Name: "Зал C", Rows: 7, Cols: 10},
        {Name: "Зал D", Rows: 9, Cols: 12},
    }
    if err := db.Create(&halls).Error; err != nil {
        return err
    }

    seats := make([]Seat, 0)
    for _, hall := range halls {
        for r := 1; r <= hall.Rows; r++ {
            for n := 1; n <= hall.Cols; n++ {
                seats = append(seats, Seat{HallID: hall.ID, Row: r, Number: n})
            }
        }
    }
    if err := db.Create(&seats).Error; err != nil {
        return err
    }

    movies := []Movie{
        {
            Title:        "Свет над городом",
            TitleEN:      "Light Over the City",
            TitleKK:      "Қала үстіндегі жарық",
            Description:  "Драматичная история о выборе между карьерой и любовью на фоне ночного мегаполиса.",
            DescriptionEN: "A dramatic story about choosing between career and love against the backdrop of a sleepless metropolis.",
            DescriptionKK: "Мегаполистің түнгі тынысы аясында мансап пен махаббат арасындағы таңдауды баяндайтын драмалық оқиға.",
            DurationMins: 114,
            PosterURL:    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80",
            Country:      "Казахстан",
            CountryEN:    "Kazakhstan",
            CountryKK:    "Қазақстан",
            Genres:       "Драма, Романтика",
            GenresEN:     "Drama, Romance",
            GenresKK:     "Драма, Романтика",
            ReleaseYear:  2023,
        },
        {
            Title:        "Предел орбиты",
            TitleEN:      "Orbit's Edge",
            TitleKK:      "Орбита шегі",
            Description:  "Научно-фантастический триллер о первой экспедиции к далекой экзопланете.",
            DescriptionEN: "A sci-fi thriller about the first expedition to a distant exoplanet.",
            DescriptionKK: "Алыс экзопланетаға алғашқы экспедиция туралы ғылыми-фантастикалық триллер.",
            DurationMins: 128,
            PosterURL:    "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80",
            Country:      "США",
            CountryEN:    "USA",
            CountryKK:    "АҚШ",
            Genres:       "Фантастика, Триллер",
            GenresEN:     "Sci-fi, Thriller",
            GenresKK:     "Ғылыми фантастика, Триллер",
            ReleaseYear:  2024,
        },
        {
            Title:        "Лунный сон",
            TitleEN:      "Moon Dream",
            TitleKK:      "Айлы түс",
            Description:  "Лирическое путешествие по воспоминаниям, где музыка меняет ход времени.",
            DescriptionEN: "A lyrical journey through memories where music bends time.",
            DescriptionKK: "Музыка уақытты өзгерткен естеліктер арқылы лирикалық саяхат.",
            DurationMins: 98,
            PosterURL:    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80",
            Country:      "Франция",
            CountryEN:    "France",
            CountryKK:    "Франция",
            Genres:       "Драма, Артхаус",
            GenresEN:     "Drama, Arthouse",
            GenresKK:     "Драма, Артхаус",
            ReleaseYear:  2022,
        },
    }
    if err := db.Create(&movies).Error; err != nil {
        return err
    }

    now := time.Now()
    location := now.Location()
    startTimes := []time.Duration{
        6 * time.Hour,
        9 * time.Hour,
        12 * time.Hour,
        15 * time.Hour,
        18 * time.Hour,
        21 * time.Hour,
        23 * time.Hour,
    }
    sessions := make([]Session, 0)
    for day := 0; day < 7; day++ {
        baseDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location).AddDate(0, 0, day)
        for hallIndex, hall := range halls {
            for timeIndex, offset := range startTimes {
                movieIndex := (day + hallIndex + timeIndex) % len(movies)
                basePrice := 400 + (timeIndex * 30) + (hallIndex * 20)
                sessions = append(sessions, Session{
                    MovieID:   movies[movieIndex].ID,
                    HallID:    hall.ID,
                    StartTime: baseDate.Add(offset),
                    BasePrice: basePrice,
                })
            }
        }
    }
    if err := db.Create(&sessions).Error; err != nil {
        return err
    }

    return nil
}
