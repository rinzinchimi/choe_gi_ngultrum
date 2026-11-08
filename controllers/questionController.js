const Question = require('../models/Question');
const Expenditure = require('../models/Expenditure');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { validateQuestion } = require('../utils/validators');

exports.postQuestion = async (req, res) => {
  try {
    const expenditureId = parseInt(req.params.id || req.body.expenditure_id, 10);
    const text = req.body.text;

    const validation = validateQuestion({ expenditure_id: expenditureId, text });
    if (!validation.isValid) {
      return res.redirect(`/expenditures/${expenditureId}?error=` + encodeURIComponent(validation.errors.join(' ')));
    }

    const exp = await Expenditure.findById(expenditureId);
    if (!exp) {
      return res.status(404).render('about', {
        title: 'Error',
        page: 'error',
        errorMessage: 'Expenditure record not found.'
      });
    }

    const userId = req.session.user.id;
    const isPublic = req.body.is_public !== 'false';

    const question = await Question.create({
      expenditureId,
      askedBy: userId,
      text: validation.data.text,
      isPublic
    });

    // Notify finance officers and admins about new student inquiry
    const staffMembers = await User.getAll({ limit: 100 });
    const financeStaff = staffMembers.filter(u => ['finance_officer', 'admin'].includes(u.role));
    for (const staff of financeStaff) {
      await Notification.create({
        userId: staff.id,
        type: 'question',
        message: `Student asked a clarification question regarding "${exp.purpose}" (Nu. ${Number(exp.amount).toLocaleString()})`,
        link: `/admin/questions#question-${question.id}`
      });
    }

    res.redirect(`/expenditures/${expenditureId}?success=` + encodeURIComponent('Your question has been submitted for review by finance staff.'));
  } catch (err) {
    console.error('Post question error:', err);
    res.status(500).render('about', {
      title: 'Submission Error',
      page: 'error',
      errorMessage: 'Could not post your question at this time.'
    });
  }
};

exports.answerQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { answer_text, document_url } = req.body;
    const user = req.session.user;

    if (!answer_text || answer_text.trim().length < 5) {
      return res.redirect('/admin/questions?error=' + encodeURIComponent('Answer must be at least 5 characters long.'));
    }

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).render('about', {
        title: 'Not Found',
        page: 'error',
        errorMessage: 'Question inquiry not found.'
      });
    }

    await Question.answer(id, {
      answerText: answer_text.trim(),
      answeredBy: user.id,
      documentUrl: document_url || null
    });

    // Notify student who asked
    await Notification.create({
      userId: question.asked_by,
      type: 'answer',
      message: `Finance staff answered your question on "${question.expenditure_purpose}"`,
      link: `/expenditures/${question.expenditure_id}`
    });

    res.redirect('/admin/questions?success=' + encodeURIComponent('Answer published successfully. The response is now visible on the record.'));
  } catch (err) {
    console.error('Answer question error:', err);
    res.status(500).render('about', {
      title: 'Answer Error',
      page: 'error',
      errorMessage: 'Could not submit answer.'
    });
  }
};
