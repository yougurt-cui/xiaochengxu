Component({
  properties: { item: Object },
  methods: {
    open() { this.triggerEvent('open', { id: this.properties.item.id }); },
    ask() { this.triggerEvent('ask', { id: this.properties.item.id }); },
  },
});
