export class TestActorParent extends JSWindowActorParent {
  constructor() {
    super();
  }
  // You don't need to implement this method, because it's inherited from
  // parent class. This exmample just forwards the arguments to the parent
  // class and adds logging
  async sendQuery(...args){
    console.log("Querying...");
    let reply = await super.sendQuery(...args);
    console.log("Got reply!");
    return reply
  }
  // Messages from child that are not responses to sendQuery are handled here
  async receiveMessage(message) {
    if(message.name === "event:info"){
      console.log("Info from Child: ",message.data.info)
    }else{
      console.log("Message: ",message.name)
    }
  }
}