// Test nested structs indexing
package main

// Address represents a physical address
type Address struct {
	Street  string
	City    string
	Country string
}

// Company represents a company with nested address
type Company struct {
	Name    string
	Address Address // 命名类型的嵌套
	Revenue float64
}

// Person with anonymous nested struct
type Person struct {
	Name string
	Age  int
	// 匿名嵌套结构体 - 深度 1
	ContactInfo struct {
		Email string
		Phone string
		// 更深层的嵌套 - 深度 2
		EmergencyContact struct {
			Name  string
			Phone string
			// 最深层嵌套 - 深度 3
			Address struct {
				Street string
				City   string
			}
		}
	}
}

// Employee with embedded struct
type Employee struct {
	Person         // 嵌入字段
	EmployeeID     string
	Department     string
	OfficeLocation Address
}

// ComplexStruct with mixed nested patterns
type ComplexStruct struct {
	ID   int
	Name string
	// 匿名嵌套
	Metadata struct {
		CreatedAt string
		UpdatedAt string
		Tags      []string
		// 深度 2 嵌套
		Author struct {
			Name  string
			Email string
		}
	}
	// 命名类型嵌套
	Owner   Person
	Company Company
}

// DeepNesting tests max depth limit (depth 4+)
type DeepNesting struct {
	Level1 struct {
		Data   string
		Level2 struct {
			Data   string
			Level3 struct {
				Data   string
				Level4 struct {
					Data   string
					Level5 struct {
						Data string // 这个深度应该被限制
					}
				}
			}
		}
	}
}
