# blog-manu

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

# next update
1. trix editor https://github.com/basecamp/trix

This project was created using `bun init` in bun v1.1.42. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

# System Context

## I am working on a software system with the following directory structure, architecture, and analyzed files:

## Directory Structure
```
├── README.md
├── app
│   ├── controller
│   │   ├── mainController.ts
│   │   └── usersController.ts
│   ├── index.ts
│   └── router
│       ├── mainRouter.ts
│       └── usersRouter.ts
├── database
│   └── index.ts
├── index.ts
├── src
│   ├── nodemailer.ts
│   ├── types.d.ts
│   └── winston-log.ts
├── test
│   ├── datatest.test.ts
│   └── nodemailer.test.ts
└── types
    └── express-session.d.ts

```

## Mermaid Diagram
```mermaid
graph TB
    User((User))
    Admin((Admin))

    subgraph "Blog Application"
        subgraph "Web Server Container [Node.js/Express]"
            Router["Router<br>Express.js"]
            CSRFProtection["CSRF Protection<br>csurf"]
            
            subgraph "Controllers"
                MainController["Main Controller<br>TypeScript"]
                UsersController["Users Controller<br>TypeScript"]
            end
            
            subgraph "Routers"
                MainRouter["Main Router<br>Express Router"]
                UsersRouter["Users Router<br>Express Router"]
            end
        end

        subgraph "Database Container [SQLite]"
            ORM["ORM Layer<br>Sequelize"]
            
            subgraph "Models"
                UsersModel["Users Model<br>Sequelize"]
                BlogsModel["Blogs Model<br>Sequelize"]
            end
            
            Database[("SQLite Database<br>SQLite3")]
        end

        subgraph "Email Service Container"
            EmailService["Email Service<br>Nodemailer"]
            OTPGenerator["OTP Generator<br>otp-generator"]
        end

        subgraph "Logging Container"
            Logger["Logger<br>Winston"]
            
            subgraph "Log Outputs"
                ConsoleTransport["Console Transport<br>Winston"]
                FileTransport["File Transport<br>Winston"]
            end
        end
    end

    %% User Interactions
    User -->|"Accesses"| Router
    Admin -->|"Manages"| Router

    %% Web Server Container Relationships
    Router -->|"Routes to"| MainRouter
    Router -->|"Routes to"| UsersRouter
    Router -->|"Protects with"| CSRFProtection
    
    MainRouter -->|"Handles requests"| MainController
    UsersRouter -->|"Handles requests"| UsersController

    %% Controller Dependencies
    MainController -->|"Queries"| ORM
    UsersController -->|"Queries"| ORM
    UsersController -->|"Sends emails"| EmailService

    %% Database Relationships
    ORM -->|"Manages"| UsersModel
    ORM -->|"Manages"| BlogsModel
    UsersModel -->|"Stores in"| Database
    BlogsModel -->|"Stores in"| Database
    UsersModel -->|"Has many"| BlogsModel

    %% Email Service Relationships
    EmailService -->|"Generates"| OTPGenerator
    EmailService -->|"Logs"| Logger

    %% Logging Relationships
    Logger -->|"Writes to"| ConsoleTransport
    Logger -->|"Writes to"| FileTransport

    %% Cross-cutting Logging
    MainController -.->|"Logs"| Logger
    UsersController -.->|"Logs"| Logger
    EmailService -.->|"Logs"| Logger
    ORM -.->|"Logs"| Logger
```

```mermaid
graph TD
    subgraph "Registration Flow"
        register["/register Route"]
        regReq["Register Request"]
        validate["Validate Input"]
        hashPwd["Hash Password"]
        createUser["Create User"]
        genToken["Generate JWT Token"]
        setCookie["Set Cookie"]
    end

    subgraph "OTP Generation & Delivery"
        otpRoute["/otp Route"]
        verifyToken["Verify JWT"]
        checkOTPStatus["Check OTP Status"]
        genOTP["Generate OTP"]
        emailPrep["Prepare Email"]
        sendMail["Send OTP Email"]
        renderOTP["Render OTP Page"]
    end

    subgraph "OTP Verification"
        verifyRoute["/verify-otp Route"]
        validateOTP["Validate OTP Input"]
        compareOTP["Compare OTP"]
        updateUser["Update User Status"]
        newToken["Generate New Token"]
        redirect["Redirect to Home"]
    end

    %% Registration Flow
    register --> regReq
    regReq --> validate
    validate --> hashPwd
    hashPwd --> createUser
    createUser --> genToken
    genToken --> setCookie
    setCookie --> otpRoute

    %% OTP Generation & Delivery
    otpRoute --> verifyToken
    verifyToken --> checkOTPStatus
    checkOTPStatus --> genOTP
    genOTP --> emailPrep
    emailPrep --> sendMail
    sendMail --> renderOTP

    %% OTP Verification
    verifyRoute --> validateOTP
    validateOTP --> compareOTP
    compareOTP -->|Match| updateUser
    updateUser --> newToken
    newToken --> redirect
    compareOTP -->|No Match| renderOTP

    %% Database Interactions
    createUser -->|Save| DB[(Database)]
    updateUser -->|Update| DB
```