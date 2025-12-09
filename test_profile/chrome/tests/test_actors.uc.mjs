// ==UserScript==
// @name test_actors
// @WindowActor TestActor
// @WindowActorMatches ["about:newtab","about:home"]
// ==/UserScript==

window.getThing = (...args) => {
  UC_API.Experimental.WindowActors.get("TestActor")?.sendQuery("doThing",{args: args})
  .then(console.log)
}