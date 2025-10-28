// Sample Go code for testing the code indexer
package example

import (
	"fmt"
	"strings"
)

// User represents a user in the system
type User struct {
	ID       int
	Name     string
	Email    string
	IsActive bool
}

// UserService handles user operations
type UserService struct {
	users map[int]*User
}

// NewUserService creates a new UserService
func NewUserService() *UserService {
	return &UserService{
		users: make(map[int]*User),
	}
}

// AddUser adds a new user to the service
func (s *UserService) AddUser(user *User) error {
	if user == nil {
		return fmt.Errorf("user cannot be nil")
	}
	s.users[user.ID] = user
	return nil
}

// GetUser retrieves a user by ID
func (s *UserService) GetUser(id int) (*User, error) {
	user, exists := s.users[id]
	if !exists {
		return nil, fmt.Errorf("user not found: %d", id)
	}
	return user, nil
}

// UpdateUser updates an existing user
func (s *UserService) UpdateUser(user *User) error {
	if _, exists := s.users[user.ID]; !exists {
		return fmt.Errorf("user not found: %d", user.ID)
	}
	s.users[user.ID] = user
	return nil
}

// DeleteUser removes a user from the service
func (s *UserService) DeleteUser(id int) error {
	delete(s.users, id)
	return nil
}

// ListActiveUsers returns all active users
func (s *UserService) ListActiveUsers() []*User {
	var activeUsers []*User
	for _, user := range s.users {
		if user.IsActive {
			activeUsers = append(activeUsers, user)
		}
	}
	return activeUsers
}

// FormatUserName formats a user's name
func FormatUserName(name string) string {
	return strings.ToUpper(name)
}

// ValidateEmail validates an email address
func ValidateEmail(email string) bool {
	return strings.Contains(email, "@")
}

// CreateUser creates a new user with validated data
func CreateUser(id int, name string, email string) (*User, error) {
	if !ValidateEmail(email) {
		return nil, fmt.Errorf("invalid email: %s", email)
	}

	formattedName := FormatUserName(name)

	return &User{
		ID:       id,
		Name:     formattedName,
		Email:    email,
		IsActive: true,
	}, nil
}

// ProcessUsers processes a batch of users
func ProcessUsers(service *UserService, users []*User) error {
	for _, user := range users {
		if err := service.AddUser(user); err != nil {
			return err
		}
	}
	return nil
}

// GetUserByEmail finds a user by email
func (s *UserService) GetUserByEmail(email string) (*User, error) {
	for _, user := range s.users {
		if user.Email == email {
			return user, nil
		}
	}
	return nil, fmt.Errorf("user not found with email: %s", email)
}

// Constants
const (
	MaxUsers        = 1000
	DefaultPageSize = 20
)

// Variables
var (
	GlobalService *UserService
	DebugMode     bool
)

// InitGlobalService initializes the global user service
func InitGlobalService() {
	GlobalService = NewUserService()
}

// Point represents a 2D point
type Point struct {
	X, Y float64
}

// Distance calculates distance from origin
func (p Point) Distance() float64 {
	return p.X*p.X + p.Y*p.Y
}

// Interface example
type Validator interface {
	Validate() error
}

// Validate implements Validator interface for User
func (u *User) Validate() error {
	if u.Name == "" {
		return fmt.Errorf("name cannot be empty")
	}
	if !ValidateEmail(u.Email) {
		return fmt.Errorf("invalid email")
	}
	return nil
}
