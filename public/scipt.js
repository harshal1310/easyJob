// JavaScript code for quiz functionality
// This is just a placeholder, you'll need to implement the actual quiz logic

// Sample quiz data
const quizData = [
    {
        question: "What is the capital of France?",
        options: ["Paris", "London", "Berlin", "Rome"],
        correctAnswer: "Paris"
    },
    {
        question: "What is 2 + 2?",
        options: ["3", "4", "5", "6"],
        correctAnswer: "4"
    }
];

// Function to load quiz questions
function loadQuiz() {
    const quizContainer = document.getElementById("quiz-container");
    quizData.forEach((question, index) => {
        const questionElement = document.createElement("div");
        questionElement.classList.add("question");
        questionElement.innerHTML = `
            <h2>Question ${index + 1}</h2>
            <p>${question.question}</p>
            <ul>
                ${question.options.map(option => `<li>${option}</li>`).join('')}
            </ul>
        `;
        quizContainer.appendChild(questionElement);
    });
}

// Call loadQuiz function to load quiz questions
window.onload = loadQuiz;
