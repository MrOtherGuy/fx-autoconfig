export class TestActorChild extends JSWindowActorChild {
  constructor() {
    super();
  }
  doThing(className){
    return Array.from(this.document.querySelectorAll(className)).map(a => a.title)
  }
  async receiveMessage(message) {
    if(message.name === "doThing"){
      return this.doThing(...message.data.args)
    }
    throw new Error(`Unknown message type: '${message.name}'`)
  }
  actorCreated(){
    // Do initialization work here if needed
  }
  handleEvent(event) {
    // This is the only event we currently support in the loader
    if (event.type === 'DOMContentLoaded') {
      this.sendAsyncMessage("event:DOMContentLoaded",{info: "this happened"});
      let h1 = this.document.createElement("h1");
      h1.textContent = "Test actor header";
      this.document.body.prepend(h1);
      this.sendAsyncMessage("event:info",{info: "Added header woo!"});
    }
  }
}