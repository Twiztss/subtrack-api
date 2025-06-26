
# SubTrack

A backend API for tracking subscription with user authentication, subscription monitoring, and reminders when the subscription reaches the renewal period. Additionally, the API is paired with bot protection and workflow. 


## Objective

Learning the *fundamentals of backend and web security* required for protecting backend API and the *workflow of request and response handling*.


## Environment Variables

To run this project, this is the required environment variables that need to be added to your .env file including :

*Server Config*
- `PORT`, `NODE_ENV`, `SERVER_URL`

*Database*
- `DB_URI`

*JWT Config*
- `JWT_SECRET`, `JWT_EXPIRES_IN`

*Arcjet Config*
- `ARCJET_KEY`, `ARCJET_ENV`,

*QStash Workflow*
- `QSTASH_URL`, `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`. `QSTASH_NEXT_SIGNING_KEY`

*Nodemailer Config*
- `EMAIL_SENDER`, `EMAIL_PASSWORD`


## Installation

Install and try subtrack-api with npm

```bash
  npm install subtrack-api
  cd subtrack-api
```
    
## API Reference

#### User Creation

```http
  POST /api/v1/auth/sign-up
```

| Parameter | Type     | Description                    |
| :-------- | :------- | :----------------------------- |
| `name`    | `string` | **Required**. Username         |
| `email`   | `string` | **Required**. Email address    |
| `password`| `string` | **Required**. password         |

- Returns the status code and sign-up data with JWT token for authorization.

#### User Authentication

```http
  POST /api/v1/auth/sign-in
```

| Parameter | Type     | Description                    |
| :-------- | :------- | :----------------------------- |
| `email`   | `string` | **Required**. Email address    |
| `password`| `string` | **Required**. password         |

- Returns the status code and user data with JWT token for authorization.

#### Get user's subscription

```http
  GET /api/v1/subsctription/user/:id
```

| Parameter | Type     | Description                       |
| :-------- | :------- | :-------------------------------- |
| `id`      | `string` | **Required**. User id             |
| `bearer token`      | `string` | **Required**. JWT token |

- Returns arrays of Subscription object.

#### Get user's subscription detail

```http
  GET /api/v1/subsctription/:id
```

| Parameter | Type     | Description                       |
| :-------- | :------- | :-------------------------------- |
| `id`      | `string` | **Required**. Subscription id     |
| `bearer token`      | `string` | **Required**. JWT token |

#### Get user's subscription detail

```http
  GET /api/v1/subsctription/upcoming-renewal
```

| Parameter | Type     | Description                       |
| :-------- | :------- | :-------------------------------- |
| `bearer token`      | `string` | **Required**. JWT token |

#### Cancel user's subscription

```http
  PUT /api/v1/subsctription/:id/cancel
```

| Parameter | Type     | Description                       |
| :-------- | :------- | :-------------------------------- |
| `id`      | `string` | **Required**. Subscription id     |
| `bearer token`      | `string` | **Required**. JWT token |

#### Remove user's subscription
```http
  DELETE /api/v1/subsctription/:id/remove
```

 - *To be added*

#### Get expired subscription
```http
  GET /api/v1/subsctription/expired
```

- *To be added*

