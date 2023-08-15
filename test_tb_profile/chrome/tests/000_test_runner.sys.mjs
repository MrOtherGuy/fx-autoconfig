// ==UserScript==
// @name           test_runner
// @description    module which runs and logs test results
// ==/UserScript==

import { setTimeout } from "resource://gre/modules/Timer.sys.mjs";

class Result{
  constructor(test){
    this.expected = test.expected;
    this.value = test.value;
    this.name = test.name;
  }
  static From(test){
    if(typeof test.expected === "function"){
      return test.expected(test.value) === true
        ? new Success(test)
        : new Failure(test)
    }
    if( test.value === test.expected ){
      return new Success( test )
    }
    return new Failure( test )
  }
  log(){
    console.info(`%c${this.name}: test was skipped`,"color: dodgerblue")
  }
}

class Failure extends Result{
  constructor(test){
    super(test);
  }
  log(){
    let expected = (typeof this.expected === "function") ? "<function>" : this.expected;
    console.warn(`${this.name} failed: expected:\n${expected}\ngot:\n${this.value}`);
  }
}

class Success extends Result{
  constructor(test){
    super(test);
  }
  log(){
    console.info(`%c${this.name}: OK`,"color: lightgreen");
  }
}

class TestWaitable{
  #result;
  constructor(aTest){
    this.name = aTest.name;
    this.state = aTest.disabled ? Test.SKIPPED : Test.WAITING;
  }
  get result(){
    return this.#result
  }
  hasResult(){
    return this.state != Test.WAITING
  }
  setResult(res){
    this.#result = res;
    if(this.state != Test.SKIPPED){
      this.state = res instanceof Success ? Test.SUCCESS : Test.FAILURE;
    }
  }
  log(){
    if(this.hasResult()){
      this.result.log()
    }else{
      console.warn(`${this.name} failed to settle before test timeout!`)
    }
  }
}

const RESULTS = [];

class Test{
  #waitable;
  constructor(name,fun){
    this.name = name;
    this.fun = fun;
  }
  get waitable(){
    return this.#waitable;
  }
  exec(){
    return this.fun();
  }
  disable(){
    this.disabled = true;
    return this
  }
  expectAsync(expect){
    this.expected = expect;
    this.#waitable = new TestWaitable(this);
    RESULTS.push(this.#waitable);
    return Test.runnerAsync(this)
  }
  expect(expect){
    this.expected = expect;
    this.#waitable = new TestWaitable(this);
    RESULTS.push(this.#waitable);
    return Test.runner(this)
  }
  async expectError(){
    this.expected = "<Error>";
    this.#waitable = new TestWaitable(this);
    RESULTS.push(this.#waitable);
    if(this.disabled){
      this.#waitable.setResult(new Result(this));
      return this
    }
    try{
      await this.exec();
      this.value = "Success";
      this.#waitable.setResult(new Failure(this));
    }catch(ex){
      this.value = ex;
      this.#waitable.setResult(new Success(this));
    }
    return this
  }
  static FAILURE = Symbol("failure");
  static SKIPPED = Symbol("skipped");
  static SUCCESS = Symbol("success");
  static WAITING = Symbol("waiting");

  static runner(test){
    if(test.disabled){
      test.#waitable.setResult(new Result(test));
      return test
    }
    try{
      test.value = test.exec();
      test.#waitable.setResult( Result.From(test) )
    }catch(e){
      let fail = new Failure(test);
      fail.value = e;
      test.#waitable.setResult(fail);
      console.error(e);
    }
    return test
  }
  static async runnerAsync(test){
    if(test.disabled){
      test.#waitable.setResult(new Result(test));
      return test
    }
    try{
      test.value = await test.exec();
      test.#waitable.setResult( Result.From(test) )
    }catch(e){
      let fail = new Failure(test);
      fail.value = e;
      test.#waitable.setResult(fail);
      fail.log();
    }
    return test
  }
  static resolveOnTimeout(millis){
    return new Promise(res => {
      setTimeout(res,millis)
    })
  }
  static rejectOnTimeout(millis){
    return new Promise((_,reject)=>{
      setTimeout(reject,millis)
    })
  }
  
  static #state = {
    isRunning: false
  }
  
  static async waitForTestSet(aTestSet){
    const TIMEOUT = 8000;
    if(this.#state.isRunning){
      throw "a test set is already runnning"
    }
    this.#state.isRunning = true;
    try{
      let resolution = await Promise.race([Test.rejectOnTimeout(TIMEOUT),Promise.allSettled(aTestSet)]);
    }catch(ex){ }
    Test.logResults();
    this.#state.isRunning = false;
  }
  
  static logResults(){
    const passed = RESULTS.reduce((a,b) => a + (b.state === Test.SUCCESS ? 1 : 0),0);
    const failed = RESULTS.reduce((a,b) => a + (b.state === Test.FAILURE ? 1 : 0),0);
    const timed_out = RESULTS.reduce((a,b) => a + (b.hasResult() ? 0 : 1),0);
    const skipped = RESULTS.length - (passed + failed + timed_out);
    const total = RESULTS.length;
    while(RESULTS.length > 0){
      RESULTS.shift().log()
    }
    console.info(
      `%cPassed:  ${passed}/${total}\nFailed:  ${failed}/${total}\nTimeout: ${timed_out}/${total}\nSkipped: ${skipped}/${total}`,
      "color: rgb(120,160,240)");
  }
}

export { Test }