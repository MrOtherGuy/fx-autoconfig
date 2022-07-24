// ==UserScript==
// @name           test_runner
// ==/UserScript==

const { setTimeout } = ChromeUtils.import("resource://gre/modules/Timer.jsm");

class Result{
  constructor(test){
    this.expected = test.expected;
    this.value = test.value;
    this.name = test.name;
  }
  static From(test){
    if( test.value === test.expected ){
      return new Success( test )
    }
    return new Failure( test )
  }
}

class Failure extends Result{
  constructor(test){
    super(test);
  }
  log(){
    console.warn(`${this.name} failed: expected: ${this.expected} - got: ${this.value}`);
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

const RESULTS = [];

class Test{
  constructor(name,fun){
    this.name = name;
    this.fun = fun;
  }
  exec(){
    return this.fun();
  }
  expectAsync(expect){
    this.expected = expect;
    return Test.runnerAsync(this)
  }
  expect(expect){
    this.expected = expect;
    return Test.runner(this)
  }
  async expectError(){
    this.expected = "<Error>";
    try{
      await this.exec();
      this.value = "Success";
      RESULTS.push( new Failure(this) )
    }catch(ex){
      this.value = ex;
      RESULTS.push( new Success(this) )
    }
    return {}
  }
  static runner(test){
    try{
      test.value = test.exec();
      RESULTS.push( Result.From(test) )
    }catch(e){
      let fail = new Failure(test);
      fail.value = e;
      RESULTS.push(fail);
      console.error(e);
    }
    return {}
  }
  static async runnerAsync(test){
    try{
      test.value = await test.exec();
      RESULTS.push( Result.From(test) )
    }catch(e){
      let fail = new Failure(test);
      fail.value = e;
      RESULTS.push(fail);
      fail.log();
    }
    return {}
  }
  static createTimeout(){
    return new Promise(res => {
      setTimeout(res,2000)
    })
  }
  static createTimeoutLong(){
    return new Promise(res => {
      setTimeout(res,4000)
    })
  }
  static logResults(){
    while(RESULTS.length > 0){
      RESULTS.shift().log()
    }
  }
}

export { Test }