# Movie Watchlist (QVAC)

Add movies, mark them watched, and rate them. Not sure what to watch? Type a **mood** like
"something funny for the whole family" and an **on-device AI** picks the best matches from your
to-watch list. **Find similar** finds the movies in your list that feel like one you already like.

The matching runs **on your own computer** using [QVAC](https://github.com/tetherto/qvac), Tether's open-source
AI SDK. No API key, no cloud service, and your list never leaves your machine.

![screenshot](screenshot.png)

## SDK version

`@qvac/sdk` **0.19.0** (declared in `package.json`)

Functions used: `loadModel` and `embed`, with the `EMBEDDINGGEMMA_300M_Q4_0` embedding model.

## Install

You need [Node.js](https://nodejs.org) (current LTS) and a little free disk space for the model.

```bash
git clone https://github.com/YOUR-USERNAME/qvac-movie-watchlist.git
cd qvac-movie-watchlist
npm install
```

## Run

```bash
npm start
```

Then open **http://localhost:3009** in your browser.

The first start downloads the model. The watchlist works while it loads.
Click **Add sample movies**, then ask for a mood like "scary but smart".

## How it works

- The watchlist (add, watched, star ratings, filter) is plain JavaScript in the browser, saved in your browser's local storage. **Download my list** exports a backup.
- For matching, each movie's text (title, year, genre and your note) and your mood are turned into lists of numbers ("embeddings") with QVAC's `embed`. Similar meanings get similar numbers, and movies are ranked by cosine similarity, with a small bonus for exact word matches.
- The AI only knows what you type plus what it learned about famous titles, so a short note about why you want to watch a movie improves the results a lot.
- The server listens on `127.0.0.1`, so only your own computer can reach it.

## License

MIT
