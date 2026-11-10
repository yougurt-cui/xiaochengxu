Component({
  properties: {
    knowledge: { type: Object, value: null, observer(knowledge) {
      const groups = Array.isArray(knowledge?.groups) ? knowledge.groups : [];
      const questions = Array.isArray(knowledge?.questions) ? knowledge.questions : [];
      this.setData({ groups, questions, page: 0, questionPage: 0, visibleGroups: groups.slice(0, 3),
        visibleQuestions: questions.slice(0, 3), pageCount: Math.ceil(groups.length / 3) });
    } },
  },
  data: { groups: [], questions: [], visibleGroups: [], visibleQuestions: [], page: 0, questionPage: 0, pageCount: 0 },
  methods: {
    nextGroup() {
      if (this.data.pageCount < 2) return;
      const page = (this.data.page + 1) % this.data.pageCount;
      this.setData({ page, visibleGroups: this.data.groups.slice(page * 3, page * 3 + 3) }, () => this.triggerEvent('pagechange'));
    },
    nextQuestions() {
      const count = Math.ceil(this.data.questions.length / 3);
      if (count < 2) return;
      const questionPage = (this.data.questionPage + 1) % count;
      this.setData({ questionPage, visibleQuestions: this.data.questions.slice(questionPage * 3, questionPage * 3 + 3) });
    },
    ask(event) {
      const question = this.data.visibleQuestions[Number(event.currentTarget.dataset.index)];
      if (question) this.triggerEvent('question', { question });
    },
  },
});
