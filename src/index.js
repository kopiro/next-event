require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { formatDistance, formatRelative } = require("date-fns");
const { google } = require("googleapis");
const { v4: uuidv4 } = require("uuid");

const TOKENS_DIR = "tokens";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
);

const scopes = ["https://www.googleapis.com/auth/calendar.events.readonly"];

const fastify = require("fastify")({
  logger: true,
});

fastify.get("/", async (request, reply) => {
  if (!request.query.id) {
    return reply.redirect("/login");
  }

  if (!/^[a-z0-9-]+$/.test(request.query.id)) {
    return reply.send("Invalid ID");
  }

  const file = path.join(TOKENS_DIR, `${request.query.id}.json`);
  if (!fs.existsSync(file)) {
    return reply.send("Not existing ID");
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:8080/oauth_redirect"
  );

  const tokens = JSON.parse(fs.readFileSync(file));
  auth.setCredentials(tokens);

  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
  });

  const event = res.data.items[0];
  const now = new Date();

  const startTime = new Date(event.start.dateTime || event.start.date);
  const relative = formatRelative(startTime, now);
  const distance = formatDistance(startTime, now, { addSuffix: true });

  const output = [
    event.summary,
    startTime <= now
      ? `[NOW] started ${distance}`
      : `${distance} (${relative})`,
  ].join("\n");

  return reply.send(output);
});

fastify.get("/login", (request, reply) => {
  const url = oauth2Client.generateAuthUrl({
    prompt: "consent",
    access_type: "offline",
    scope: scopes,
  });
  reply.redirect(url);
});

fastify.get("/oauth_redirect", async (request, reply) => {
  const uuid = uuidv4();
  const { tokens } = await oauth2Client.getToken(request.query.code);
  fs.writeFileSync(
    path.join(TOKENS_DIR, `${uuid}.json`),
    JSON.stringify(tokens)
  );
  reply.redirect(`/?id=${uuid}`);
});

// Run the server!
fastify.listen(process.env.PORT || 8080, "0.0.0.0", (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`server listening on ${address}`);
});
