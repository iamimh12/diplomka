# Build stage
FROM golang:1.25 AS builder
WORKDIR /app

RUN apk add --no-cache git

COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o kinoform-server .

# Runtime stage
FROM alpine:3.20
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=build /app/kinoform-server ./kinoform-server

EXPOSE 8080

ENV PORT=8080

CMD ["./kinoform-server"]
