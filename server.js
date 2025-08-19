const Prometheus = require('prom-client')
const express = require('express');
const http = require('http');

Prometheus.collectDefaultMetrics();

const requestHistogram = new Prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['code', 'handler', 'method'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
})

const requestTimer = (req, res, next) => {
  const path = new URL(req.url, `http://${req.hostname}`).pathname
  const stop = requestHistogram.startTimer({
    method: req.method,
    handler: path
  })
  res.on('finish', () => {
    stop({
      code: res.statusCode
    })
  })
  next()
}

const app = express();
const server = http.createServer(app)

// See: http://expressjs.com/en/4x/api.html#app.settings.table
const PRODUCTION = app.get('env') === 'production';

// Administrative routes are not timed or logged, but for non-admin routes, pino
// overhead is included in timing.
app.get('/ready', (req, res) => res.status(200).json({status:"ok"}));
app.get('/live', (req, res) => res.status(200).json({status:"ok"}));
app.get('/metrics', async (req, res, next) => {
  const metrics = await Prometheus.register.metrics();
  res.set('Content-Type', Prometheus.register.contentType)
  res.end(metrics);
})

// Time routes after here.
app.use(requestTimer);

// Log routes after here.

const pino = require('pino')({
  level: PRODUCTION ? 'info' : 'debug',
});
app.use(require('pino-http')({logger: pino}));

// For parsing JSON bodies
app.use(express.json());

// Threat analysis route
app.post('/threat-analysis', async (req, res) => {
  try {
  // Use @google/genai
  const { GoogleGenerativeAI } = await import("@google/genai");
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY not set." });
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const { userInput } = req.body;
    if (!userInput) {
      return res.status(400).json({ error: "Missing userInput." });
    }
    const prompt = `
You are a world-class financial privacy and sovereignty expert writing copy for the obligato.io landing page. Your tone is authoritative, direct, and designed to create a sense of urgency.

A user has described their financial situation. Your task is to analyze their potential exposure to three core threats:
1. **Financial Surveillance:** (Mention risks like the Travel Rule, automatic reporting, and how their assets might be tracked).
2. **Systemic Risk:** (Mention risks like fiat debasement, central points of failure, and institutional fragility).
3. **Lack of True Ownership:** (Mention how their assets are liabilities on someone else's balance sheet).

User's situation:
"${userInput}"

Based on this, generate a concise "Personalized Threat Report". The report should be 2-3 short paragraphs. Use strong, punchy language. Start with a direct headline like "**ANALYSIS: Your Exposure Profile**". Do not offer a solution, only agitate the problem. Use markdown for bolding (**text**) and bullet points (* item).
    `;
    const result = await genAI.models.generateContent({
    model: 'gemini-2.0-flash-001',
    contents: prompt,
  });

  const text = result.response.text();
    res.status(200).json({ analysis: text });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to generate threat analysis." });
  }
});

app.get('/', (req, res) => {
  // Use req.log (a `pino` instance) to log JSON:
  req.log.info({message: 'Hello from Node.js Starter Application!'});
  res.send('Hello from Node.js Starter Application!');
});

app.get('*', (req, res) => {
  res.status(404).send("Not Found");
});


// Listen and serve.
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`App started on PORT ${PORT}`);
});
