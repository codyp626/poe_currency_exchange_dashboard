# Installation Guide

## Quick Start

1. **Install backend dependencies:**
   ```bash
   npm install
   ```

2. **Install frontend dependencies:**
   ```bash
   cd client
   npm install
   cd ..
   ```

3. **Start the backend server:**
   ```bash
   npm start
   ```
   
   The server will start on `http://localhost:5000`

4. **Start the frontend (in a new terminal window):**
   ```bash
   cd client
   npm start
   ```
   
   The dashboard will open at `http://localhost:3000`

## MongoDB Configuration

**Important**: Create a `.env` file in the root directory with the following content:

```
MONGO_URI=mongodb+srv://codyprochaska26_db_user:crimson-password@cluster0.8zjezsd.mongodb.net/?appName=Cluster0
DB_NAME=currency
COLLECTION_NAME=price_history2
PORT=5000
```

This file contains your MongoDB connection credentials and should be created before starting the server.

## Troubleshooting

### "Invalid options object" Error

If you see an error about `options.allowedHosts[0] should be a non-empty string`:
1. The proxy configuration has been fixed
2. Run `npm install` again in the `client` directory
3. Restart the server

### Port Already in Use

If port 5000 or 3000 is already in use:
- Backend: Change `PORT` in `.env` or set `PORT=5001 npm start`
- Frontend: React will ask to use a different port automatically

### MongoDB Connection Issues

- Check your IP is whitelisted in MongoDB Atlas
- Verify the connection string is correct
- Check that the database and collection exist

### No Data Showing

- Verify documents exist in your MongoDB collection
- Check browser console for errors
- Check backend terminal for connection errors
- Ensure data format matches the expected structure

## Development Mode

For auto-restart on backend changes:
```bash
npm run dev
```

## Building for Production

```bash
cd client
npm run build
```

Then serve the `client/build` folder with any static file server.

