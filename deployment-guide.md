# Deployment Guide

## Environment Variables
- `NODE_ENV`: production
- `PORT`: 3000
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: secret for JWT tokens
- `STRIPE_SECRET_KEY`: Stripe secret key

## Deploy to Render
1. Create a Web Service on Render
2. Set build command: `docker build -t app .`
3. Set start command: `docker run -p 3000:3000 app`
4. Add environment variables from above
5. Deploy

## Deploy to Railway
1. Connect GitHub repository
2. Add environment variables
3. Railway auto-detects Dockerfile
4. Deploy

## Deploy to VPS
1. Install Docker and Docker Compose
2. Clone repository
3. Create `.env` file with all variables
4. Run `docker-compose up -d`
5. Health check: `curl http://localhost:3000/health`