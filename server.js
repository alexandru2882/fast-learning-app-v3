// server.js - Fast Learning App V3 Backend
require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

// OpenAI API integration:
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY, // Your OpenAI API key from the .env file
});
const openai = new OpenAIApi(configuration);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());
// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

/**
 * POST /chat
 * Expects a JSON body with:
 *  - message: The latest user message.
 *  - conversation (optional): Previous chat context.
 * Combines the context with the new message and uses OpenAI to generate a reply.
 */
app.post('/chat', async (req, res) => {
  const { message, conversation } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  try {
    // Build a conversation prompt:
    let prompt = "";
    if (conversation) {
      prompt += conversation + "\n";
    }
    prompt += `User: ${message}\nTutor:`;

    // Use the Chat API endpoint (gpt-3.5-turbo) to generate a response.
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are Tutor Bot. Provide clear, helpful answers." },
        { role: "user", content: prompt }
      ]
    });
    const reply = completion.data.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error('Error in /chat:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate chat response. Please try again later.' });
  }
});

/**
 * GET /lesson
 * Query parameters: lessonId (required) and language (default: "Python")
 * Generates an interactive lesson using OpenAI.
 */
app.get('/lesson', async (req, res) => {
  const { lessonId, language = "Python" } = req.query;
  if (!lessonId) {
    return res.status(400).json({ error: 'lessonId query parameter is required.' });
  }
  try {
    // Map lesson IDs to topics
    const topics = {
      "1": "Variables and Data Types",
      "2": "Control Structures",
      "3": "Functions",
      "4": "Object-Oriented Programming"
    };
    const topic = topics[lessonId] || `Lesson ${lessonId}`;
    const prompt = `
Generate an interactive lesson for a student learning ${language}.
The lesson topic is "${topic}".
The lesson should include:
  - A brief explanation of the topic.
  - Code examples (formatted with Markdown code blocks and comments).
  - A coding exercise for the student.
Provide clear, concise instructions.
    `;
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are Tutor Bot providing interactive lessons." },
        { role: "user", content: prompt }
      ]
    });
    const lessonContent = completion.data.choices[0].message.content;
    res.json({ prompt: lessonContent, topic });
  } catch (error) {
    console.error('Error in /lesson:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate lesson content. Please try again later.' });
  }
});

/**
 * POST /submit-code
 * Expects a JSON body with:
 *  - code: The student's code submission.
 *  - lessonId (optional): The current lesson identifier.
 * Uses OpenAI to provide feedback on the code submission.
 */
app.post('/submit-code', async (req, res) => {
  const { code, lessonId } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code is required.' });
  }
  try {
    const prompt = `
Please review the following code submission for the coding exercise:

${code}

Provide polite, concise feedback. If the code is correct, indicate that it is correct and suggest moving on to the next lesson.
    `;
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are Tutor Bot reviewing code submissions." },
        { role: "user", content: prompt }
      ]
    });
    const feedback = completion.data.choices[0].message.content;
    res.json({ feedback });
  } catch (error) {
    console.error('Error in /submit-code:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to evaluate code. Please try again later.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Fast Learning App backend is running on port ${PORT}`);
});
