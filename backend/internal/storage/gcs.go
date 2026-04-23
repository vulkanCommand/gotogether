package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cloud.google.com/go/storage"
)

const defaultTripPhotosBucket = "gotogether-783eb-media-501556960072"

func UploadTripPhoto(ctx context.Context, tripID int, userID int, filename string, contentType string, reader io.Reader) (string, error) {
	return uploadMediaObject(ctx, fmt.Sprintf("trips/%d/photos", tripID), userID, filename, contentType, reader)
}

func UploadTripCover(ctx context.Context, tripID int, userID int, filename string, contentType string, reader io.Reader) (string, error) {
	return uploadMediaObject(ctx, fmt.Sprintf("trips/%d/cover", tripID), userID, filename, contentType, reader)
}

func UploadProfileImage(ctx context.Context, userID int, filename string, contentType string, reader io.Reader) (string, error) {
	return uploadMediaObject(ctx, fmt.Sprintf("users/%d/profile", userID), userID, filename, contentType, reader)
}

func uploadMediaObject(ctx context.Context, prefix string, userID int, filename string, contentType string, reader io.Reader) (string, error) {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create storage client: %w", err)
	}
	defer client.Close()

	bucketName := strings.TrimSpace(os.Getenv("TRIP_PHOTOS_BUCKET"))
	if bucketName == "" {
		bucketName = defaultTripPhotosBucket
	}

	extension := strings.ToLower(filepath.Ext(filename))
	if extension == "" {
		extension = ".jpg"
	}

	objectName := fmt.Sprintf("%s/%d-%d%s", strings.Trim(prefix, "/"), userID, time.Now().UnixNano(), extension)
	writer := client.Bucket(bucketName).Object(objectName).NewWriter(ctx)
	writer.ContentType = contentType
	writer.CacheControl = "public, max-age=3600"

	if _, err := io.Copy(writer, reader); err != nil {
		_ = writer.Close()
		return "", fmt.Errorf("failed to upload object: %w", err)
	}

	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("failed to finalize object: %w", err)
	}

	return (&url.URL{
		Scheme: "https",
		Host:   "storage.googleapis.com",
		Path:   "/" + bucketName + "/" + objectName,
	}).String(), nil
}

func OpenObjectByURL(ctx context.Context, objectURL string) (io.ReadCloser, string, error) {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create storage client: %w", err)
	}

	parsed, err := url.Parse(strings.TrimSpace(objectURL))
	if err != nil {
		client.Close()
		return nil, "", fmt.Errorf("invalid object url: %w", err)
	}

	path := strings.TrimPrefix(parsed.Path, "/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) != 2 {
		client.Close()
		return nil, "", fmt.Errorf("invalid storage path")
	}

	reader, err := client.Bucket(parts[0]).Object(parts[1]).NewReader(ctx)
	if err != nil {
		client.Close()
		return nil, "", fmt.Errorf("failed to open object: %w", err)
	}

	return &storageReadCloser{reader: reader, client: client}, reader.Attrs.ContentType, nil
}

type storageReadCloser struct {
	reader *storage.Reader
	client *storage.Client
}

func (src *storageReadCloser) Read(p []byte) (int, error) {
	return src.reader.Read(p)
}

func (src *storageReadCloser) Close() error {
	readErr := src.reader.Close()
	clientErr := src.client.Close()
	if readErr != nil {
		return readErr
	}
	return clientErr
}
