const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const Attempt = require("../models/attempt");
const Answer = require("../models/answer");
const Question = require("../models/question");

router.get(
  "/history",
  requireAuth,
  requireRole(["student"]),
  async (req, res) => {
    try {
      const attempts = await Attempt.find({ studentId: req.session.user.id })
        .populate("quizId")
        .sort({ startedAt: -1 });

      res.render("attempt/history", { attempts, error: null });
    } catch (error) {
      res.render("attempt/history", {
        attempts: [],
        error: "Unable to load attempt history",
      });
    }
  },
);

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id)
      .populate("quizId")
      .populate("studentId");

    if (!attempt || attempt.studentId._id.toString() !== req.session.user.id) {
      return res.status(404).send("Attempt not found");
    }

    const answers = await Answer.find({ attemptId: attempt._id }).populate(
      "questionId",
    );
    const questions = await Question.find({ quizId: attempt.quizId._id }).sort({
      _id: 1,
    });
    const answerMap = new Map(
      answers.map((answer) => [answer.questionId._id.toString(), answer]),
    );

    res.render("attempt/review", {
      attempt,
      questions,
      answerMap,
    });
  } catch (error) {
    res.status(500).send("Unable to load attempt review");
  }
});

module.exports = router;
