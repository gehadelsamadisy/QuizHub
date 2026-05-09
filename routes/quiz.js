const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const Quiz = require("../models/quiz");
const Question = require("../models/question");
const Attempt = require("../models/attempt");
const Answer = require("../models/answer");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "..", "uploads", "attempts");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage });

function gradeQuizSubmission(questions, formAnswers, uploadedFiles) {
  let totalScore = 0;
  let maxScore = 0;
  let needsManualReview = false;

  const answerDocuments = questions.map((question) => {
    const questionId = question._id.toString();
    const rawAnswer = formAnswers[`answer_${questionId}`];
    const fileMatch = uploadedFiles.find(
      (file) => file.fieldname === `question_${questionId}`,
    );

    maxScore += question.points || 0;

    if (question.type === "mcq") {
      const selectedOption =
        rawAnswer === undefined || rawAnswer === ""
          ? undefined
          : Number(rawAnswer);
      const option =
        selectedOption === undefined ? null : question.options[selectedOption];
      const isCorrect = Boolean(option && option.isCorrect);
      const score = isCorrect ? question.points || 0 : 0;
      totalScore += score;

      return {
        questionId: question._id,
        selectedOption,
        isCorrect,
        score,
      };
    }

    needsManualReview = true;

    return {
      questionId: question._id,
      textAnswer: question.type === "written" ? rawAnswer || "" : undefined,
      uploadedFile: fileMatch ? fileMatch.filename : undefined,
      score: 0,
    };
  });

  return {
    answerDocuments,
    totalScore,
    maxScore,
    gradingStatus: needsManualReview ? "pending-review" : "auto-graded",
  };
}

router.get("/create", requireAuth, requireRole(["teacher"]), (req, res) => {
  res.render("quiz/create", { error: null });
});

router.post(
  "/create",
  requireAuth,
  requireRole(["teacher"]),
  async (req, res) => {
    try {
      const { title, description, subject, timeLimit, passingScore } = req.body;
      const quiz = new Quiz({
        title,
        description,
        subject,
        timeLimit: parseInt(timeLimit),
        passingScore: parseInt(passingScore),
        createdBy: req.session.user.id,
      });
      await quiz.save();
      res.redirect("/quiz/my-quizzes");
    } catch (err) {
      res.render("quiz/create", { error: "Failed to create quiz" });
    }
  },
);

router.get(
  "/my-quizzes",
  requireAuth,
  requireRole(["teacher"]),
  async (req, res) => {
    try {
      const quizzes = await Quiz.find({ createdBy: req.session.user.id });
      res.render("quiz/my-quizzes", { quizzes });
    } catch (err) {
      res.render("quiz/my-quizzes", { quizzes: [] });
    }
  },
);

router.get(
  "/:id/add-questions",
  requireAuth,
  requireRole(["teacher"]),
  async (req, res) => {
    try {
      const quiz = await Quiz.findById(req.params.id);
      if (!quiz || quiz.createdBy.toString() !== req.session.user.id) {
        return res.redirect("/quiz/my-quizzes");
      }
      res.render("quiz/add-questions", { quiz });
    } catch (err) {
      res.redirect("/quiz/my-quizzes");
    }
  },
);

router.post(
  "/:id/add-questions",
  requireAuth,
  requireRole(["teacher"]),
  async (req, res) => {
    try {
      const quiz = await Quiz.findById(req.params.id);
      if (!quiz || quiz.createdBy.toString() !== req.session.user.id) {
        return res.redirect("/quiz/my-quizzes");
      }

      const { questions } = req.body;
      for (const q of questions) {
        const question = new Question({
          quizId: quiz._id,
          text: q.text,
          type: q.type,
          points: parseInt(q.points) || 1,
          options: q.type === 'mcq' && q.options
            ? q.options
                .filter(opt => opt.text && opt.text.trim() !== '')
                .map((opt, idx) => ({
                  text: opt.text,
                  isCorrect: idx === parseInt(q.correctOption),
                }))
            : [],
        });
        await question.save();
      }
      
      res.redirect("/quiz/my-quizzes");
    } catch (err) {
      console.error('Add questions error:', err.message);
      return res.redirect('/quiz/my-quizzes');
    }
  },
);

router.post(
  "/:id/publish",
  requireAuth,
  requireRole(["teacher"]),
  async (req, res) => {
    try {
      const quiz = await Quiz.findById(req.params.id);
      if (
        quiz &&
        quiz.createdBy.toString() === req.session.user.id &&
        quiz.status === "draft"
      ) {
        quiz.status = "published";
        await quiz.save();
      }
      res.redirect("/quiz/my-quizzes");
    } catch (err) {
      res.redirect("/quiz/my-quizzes");
    }
  },
);

router.get(
  "/browse",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    try {
      const { subject } = req.query;
      const filter = { status: "published" };
      if (subject) filter.subject = subject;

      const quizzes = await Quiz.find(filter);
      res.render("quiz/browse", { quizzes, subject });
    } catch (err) {
      res.render("quiz/browse", { quizzes: [] });
    }
  },
);

router.get(
  "/:id/take",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    try {
      const quiz = await Quiz.findOne({
        _id: req.params.id,
        status: "published",
      });
      if (!quiz) {
        return res.status(404).send("Quiz not available");
      }

      const questions = await Question.find({ quizId: quiz._id }).sort({
        _id: 1,
      });
      const maxScore = questions.reduce(
        (sum, question) => sum + (question.points || 0),
        0,
      );
      let attempt = await Attempt.findOne({
        studentId: req.session.user.id,
        quizId: quiz._id,
      });

      if (attempt && attempt.submittedAt) {
        return res.redirect(`/attempt/${attempt._id}`);
      }

      if (!attempt) {
        attempt = await Attempt.create({
          studentId: req.session.user.id,
          quizId: quiz._id,
          maxScore,
        });
      } else if (attempt.maxScore !== maxScore) {
        attempt.maxScore = maxScore;
        await attempt.save();
      }

      const answers = await Answer.find({ attemptId: attempt._id });
      const answerMap = new Map(
        answers.map((answer) => [answer.questionId.toString(), answer]),
      );

      res.render("quiz/take", {
        quiz,
        questions,
        attempt,
        answerMap,
        timeLimit: quiz.timeLimit,
      });
    } catch (error) {
      res.status(500).send("Unable to open quiz");
    }
  },
);

router.post(
  "/:id/submit",
  requireAuth,
  requireRole(["student"]),
  upload.any(),
  async (req, res) => {
    try {
      const quiz = await Quiz.findOne({
        _id: req.params.id,
        status: "published",
      });
      if (!quiz) {
        return res.status(404).send("Quiz not available");
      }

      const attempt = await Attempt.findOne({
        _id: req.body.attemptId,
        studentId: req.session.user.id,
        quizId: quiz._id,
      });

      if (!attempt) {
        return res.status(404).send("Attempt not found");
      }

      if (attempt.submittedAt) {
        return res.redirect(`/attempt/${attempt._id}`);
      }

      const questions = await Question.find({ quizId: quiz._id }).sort({
        _id: 1,
      });
      const grading = gradeQuizSubmission(
        questions,
        req.body || {},
        req.files || [],
      );

      await Answer.deleteMany({ attemptId: attempt._id });
      if (grading.answerDocuments.length > 0) {
        await Answer.insertMany(
          grading.answerDocuments.map((answer) => ({
            attemptId: attempt._id,
            ...answer,
          })),
        );
      }

      attempt.totalScore = grading.totalScore;
      attempt.maxScore = grading.maxScore;
      attempt.gradingStatus = grading.gradingStatus;
      attempt.passed =
        grading.gradingStatus === "auto-graded" && grading.maxScore > 0
          ? grading.totalScore >= (quiz.passingScore / 100) * grading.maxScore
          : false;
      attempt.submittedAt = new Date();
      await attempt.save();

      res.redirect(`/attempt/${attempt._id}`);
    } catch (error) {
      res.status(500).send("Unable to submit quiz");
    }
  },
);

router.get('/:id/view', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz || quiz.createdBy.toString() !== req.session.user.id) {
      return res.redirect('/quiz/my-quizzes');
    }
    const questions = await Question.find({ quizId: quiz._id });
    res.render('quiz/view', { quiz, questions });
  } catch (err) {
    res.redirect('/quiz/my-quizzes');
  }
});

module.exports = router;
