
# SubTrack

A backend API for tracking subscriptions with user authentication, subscription monitoring, and automated renewal reminders. The API includes bot protection via Arcjet and automated email workflows via Upstash QStash.


## Objective

Learning the *fundamentals of backend and web security* required for protecting backend APIs and the *workflow of request and response handling*.


## Environment Variables

To run this project, add the following environment variables to your `.env` file:

*Server Config*
- `PORT`, `NODE_ENV`, `SERVER_URL`

*Database*
- `DB_URI`

*JWT Config*
- `JWT_SECRET`, `JWT_EXPIRES_IN`

*Arcjet Config*
- `ARCJET_KEY`, `ARCJET_ENV`

*Upstash Workflow*
- `QSTASH_URL`, `QSTASH_TOKEN`, `ENABLE_WORKFLOW`
- `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`

*Nodemailer Config*
- `EMAIL_SENDER`, `EMAIL_PASSWORD`


## Installation

```bash
  git clone <repo-url>
  cd subtrack-api
  npm install
  npm start
```


## API Reference

### Authentication

#### Sign Up

```http
POST /api/v1/auth/sign-up
```

| Parameter  | Type     | Description                 |
| :--------- | :------- | :-------------------------- |
| `name`     | `string` | **Required.** Username      |
| `email`    | `string` | **Required.** Email address |
| `password` | `string` | **Required.** Password      |

Returns the created user object with a JWT token for authorization.

#### Sign In

```http
POST /api/v1/auth/sign-in
```

| Parameter  | Type     | Description                 |
| :--------- | :------- | :-------------------------- |
| `email`    | `string` | **Required.** Email address |
| `password` | `string` | **Required.** Password      |

Returns the authenticated user object with a JWT token for authorization.

#### Sign Out

```http
POST /api/v1/auth/sign-out
```

Returns a sign-out confirmation message.

---

### Users

#### Get All Users

```http
GET /api/v1/user
```

Returns an array of all users.

#### Get User by ID

```http
GET /api/v1/user/:id
```

| Parameter      | Type     | Description                        |
| :------------- | :------- | :--------------------------------- |
| `id`           | `string` | **Required.** User ID              |
| `Bearer token` | `string` | **Required.** JWT token (header)   |

Returns the user object (password field excluded).

#### Edit User

```http
PUT /api/v1/user/:id/edit
```

| Parameter      | Type     | Description                        |
| :------------- | :------- | :--------------------------------- |
| `id`           | `string` | **Required.** User ID              |
| `Bearer token` | `string` | **Required.** JWT token (header)   |
| `name`         | `string` | Optional. New name                 |
| `email`        | `string` | Optional. New email                |
| `password`     | `string` | Optional. New password (re-hashed) |

At least one body field is required. Returns the updated user object.

#### Delete User

```http
DELETE /api/v1/user/:id/remove
```

| Parameter | Type     | Description          |
| :-------- | :------- | :------------------- |
| `id`      | `string` | **Required.** User ID |

Returns a deletion confirmation message.

---

### Subscriptions

All subscription endpoints (except `/filter`) require a `Bearer token` in the `Authorization` header.

#### Get All Subscriptions

```http
GET /api/v1/subscription
```

Supports pagination and filtering via query parameters: `page`, `limit`, `sort`, `name`, `status`, `category`, `price`, `renewalDate`.

Returns a paginated list of subscriptions.

#### Get Upcoming Renewals

```http
GET /api/v1/subscription/upcoming-renewals
```

Returns subscriptions renewing within the next 7 days.

#### Get Filter Reference

```http
GET /api/v1/subscription/filter
```

Returns the list of available filter fields and a usage example.

#### Get Subscription by ID

```http
GET /api/v1/subscription/:id
```

| Parameter | Type     | Description                   |
| :-------- | :------- | :---------------------------- |
| `id`      | `string` | **Required.** Subscription ID |

Returns the subscription object.

#### Create Subscription

```http
POST /api/v1/subscription
```

| Parameter     | Type     | Description                                              |
| :------------ | :------- | :------------------------------------------------------- |
| `name`        | `string` | **Required.** Subscription name                          |
| `price`       | `number` | **Required.** Subscription cost                          |
| `renewalDate` | `date`   | **Required.** Next renewal date (ISO 8601)               |
| `category`    | `string` | **Required.** Category name (created automatically if new) |
| `status`      | `string` | Optional. Subscription status                            |

Returns the created subscription along with workflow and reminder metadata.
A confirmation email is sent to the authenticated user.

#### Edit Subscription

```http
PUT /api/v1/subscription/:id/edit
```

| Parameter | Type     | Description                   |
| :-------- | :------- | :---------------------------- |
| `id`      | `string` | **Required.** Subscription ID |

Accepts any updatable subscription fields in the request body. At least one field is required.
Returns the updated subscription object.

#### Cancel Subscription

```http
PUT /api/v1/subscription/:id/cancel
```

| Parameter | Type     | Description                   |
| :-------- | :------- | :---------------------------- |
| `id`      | `string` | **Required.** Subscription ID |

Sets the subscription payment status to `expired`. Returns the updated subscription object.

#### Delete Subscription

```http
DELETE /api/v1/subscription/:id/remove
```

| Parameter | Type     | Description                   |
| :-------- | :------- | :---------------------------- |
| `id`      | `string` | **Required.** Subscription ID |

Returns a deletion confirmation message.

#### Get User's Subscriptions

```http
GET /api/v1/subscription/user/:id
```

| Parameter | Type     | Description          |
| :-------- | :------- | :------------------- |
| `id`      | `string` | **Required.** User ID |

Supports pagination and filtering via query parameters: `page`, `limit`, `sort`, `name`, `status`, `category`, `price`, `renewalDate`.

Returns a paginated list of the user's subscriptions.

#### Get User's Subscription Summary

```http
GET /api/v1/subscription/user/:id/summary
```

| Parameter | Type     | Description          |
| :-------- | :------- | :------------------- |
| `id`      | `string` | **Required.** User ID |

Returns a summary of the user's subscriptions including total count, total cost, and the most expensive subscription.

---

### Categories

#### Get All Categories

```http
GET /api/v1/category
```

Supports pagination and sorting via query parameters: `page`, `limit`, `sort`.

Returns a paginated list of categories.

#### Get Category by ID

```http
GET /api/v1/category/:id
```

| Parameter | Type     | Description           |
| :-------- | :------- | :-------------------- |
| `id`      | `string` | **Required.** Category ID |

Returns the category object and its subscription count.

#### Create Category

```http
POST /api/v1/category
```

| Parameter | Type     | Description              |
| :-------- | :------- | :----------------------- |
| `name`    | `string` | **Required.** Category name |

Returns the created category object.

#### Update Category

```http
PUT /api/v1/category/:id
```

| Parameter | Type     | Description              |
| :-------- | :------- | :----------------------- |
| `id`      | `string` | **Required.** Category ID |
| `name`    | `string` | **Required.** New name   |

Returns the updated category object.

#### Delete Category

```http
DELETE /api/v1/category/:id
```

| Parameter | Type     | Description              |
| :-------- | :------- | :----------------------- |
| `id`      | `string` | **Required.** Category ID |

Returns a deletion confirmation message and the deleted category object.

---

### Workflow (Internal)

#### Send Subscription Reminders

```http
POST /api/v1/workflow/subscription/reminder
```

This endpoint is called internally by Upstash QStash and requires a valid QStash signature in the request headers. It sends a renewal reminder email for the given subscription.

| Body Field       | Type     | Description                   |
| :--------------- | :------- | :---------------------------- |
| `subscriptionId` | `string` | **Required.** Subscription ID |
