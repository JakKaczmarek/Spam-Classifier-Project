const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const csv = require("csv-parser");
const fs = require("fs");
const natural = require("natural");
const { WordTokenizer, PorterStemmer, stopwords } = natural;
const { htmlToText } = require("html-to-text");
const { ConfusionMatrix } = require("ml-confusion-matrix");

const app = express();
app.use(bodyParser.json());
app.use(cors());

const classifier = new natural.BayesClassifier();
const tokenizer = new WordTokenizer();
let isTrained = false;
let testData = [];
let metrics = {};

// Function to clean text
const cleanText = (text) => {
  text = text.replace(/https?:\/\/[^\s]+/g, "");
  text = text.replace(/\S+@\S+\.\S+/g, "");
  text = text.replace(/mailing list[\s\S]+/gi, "");
  return text;
};

// Map numerical labels to readable labels
const labelMap = {
  0: "Not spam",
  1: "Spam",
};

// Function to train the classifier
const trainClassifier = () => {
  const trainingData = [];
  fs.createReadStream("spam_NLP.csv")
    .pipe(csv())
    .on("data", (row) => {
      try {
        if (row.MESSAGE) {
          let text = htmlToText(row.MESSAGE);
          text = cleanText(text);
          text = text.toLowerCase();
          let tokens = tokenizer.tokenize(text);
          tokens = tokens.filter((token) => !stopwords.includes(token));
          tokens = tokens.map((token) => PorterStemmer.stem(token));
          const processedText = tokens.join(" ");

          const label = labelMap[row.CATEGORY] || row.CATEGORY;
          if (Math.random() < 0.9) {
            trainingData.push({ text: processedText, label });
          } else {
            testData.push({ text: processedText, label });
          }
        } else {
          console.error('Row missing "MESSAGE" property:', row);
        }
      } catch (error) {
        console.error("Error processing row:", row, error);
      }
    })
    .on("end", () => {
      trainingData.forEach((data) => {
        classifier.addDocument(data.text, data.label);
      });
      classifier.train();
      isTrained = true;
      console.log("CSV file successfully processed and classifier trained.");

      updateMetrics();
    });
};

// Function to evaluate the classifier
const evaluateClassifier = (data) => {
  const start = Date.now();
  const trueLabels = [];
  const predictedLabels = [];

  data.forEach((data) => {
    const prediction = classifier.classify(data.text);
    trueLabels.push(data.label);
    predictedLabels.push(prediction);
  });

  const confusionMatrix = ConfusionMatrix.fromLabels(
    trueLabels,
    predictedLabels
  );
  const { matrix } = confusionMatrix;

  const TP = matrix[1]?.[1] || 0;
  const TN = matrix[0]?.[0] || 0;
  const FP = matrix[0]?.[1] || 0;
  const FN = matrix[1]?.[0] || 0;

  const accuracy = (TP + TN) / (TP + TN + FP + FN);
  const precision = TP / (TP + FP);
  const recall = TP / (TP + FN);
  const f1Score = 2 * ((precision * recall) / (precision + recall));

  return {
    accuracy: (accuracy * 100).toFixed(2),
    precision: (precision * 100).toFixed(2),
    recall: (recall * 100).toFixed(2),
    f1Score: (f1Score * 100).toFixed(2),
    confusionMatrix: matrix,
  };
};

// Function to update metrics
const updateMetrics = () => {
  metrics = evaluateClassifier(testData);
};

// Start training in the background
trainClassifier();

// Endpoint for classifying email text
app.post("/classify", (req, res) => {
  if (!isTrained) {
    console.log("Classifier is still training.");
    return res
      .status(503)
      .send("Classifier is still training. Please try again later.");
  }

  try {
    const start = Date.now();
    let emailText = htmlToText(req.body.text);
    emailText = cleanText(emailText);
    emailText = emailText.toLowerCase();
    let tokens = tokenizer.tokenize(emailText);
    tokens = tokens.filter((token) => !stopwords.includes(token));
    tokens = tokens.map((token) => PorterStemmer.stem(token));
    const processedText = tokens.join(" ");

    const classification = classifier.classify(processedText);

    // Log the new data and classification
    console.log(`New message: ${emailText}`);
    console.log(`Processed text: ${processedText}`);
    console.log(`Classification: ${classification}`);

    // Update test data and re-evaluate metrics
    testData.push({ text: processedText, label: classification });
    updateMetrics();

    console.log("Updated metrics:", metrics);

    res.json({ classification, metrics });
  } catch (error) {
    console.error("Error classifying email:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
