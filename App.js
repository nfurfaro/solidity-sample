import React, { Component } from 'react'
import {Tabs, Tab} from 'material-ui/Tabs';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import TextField from 'material-ui/TextField';
import RegulatorJSON from '../build/contracts/Regulator.json'
import OperatorJSON from '../build/contracts/TollBoothOperator.json'
import getWeb3 from './utils/getWeb3'
import './css/oswald.css'
import './css/open-sans.css'
import './css/pure-min.css'
import './App.css'

const contract = require('truffle-contract')
const Operator = contract(OperatorJSON)
let newOperator
let operatorContractsList
let entryHistoryList
let exitHistoryList

const styles = {
  headline: {
    fontSize: 24,
    paddingTop: 16,
    marginBottom: 12,
    fontWeight: 400,
  },
};

class App extends Component {
  constructor(props) {
    super(props)

    this.state = {
      regulatorContractInstance: {},
      tollBoothOperatorContractInstance: {},
      currentOperatorContractAddress: 0x0,
      currentOperatorOwnerAddress: 0x0,
      currentVehicleAddress: 0x0,
      currentBoothAddress: 0x0,
      tempVehicleAddress: 0x0,
      tempOperatorOwnerAddress: 0x0,
      tempOperatorContractAddress: 0x0,
      tempBoothAddress: 0x0,
      weiBalance: 0,
      ethBalance: 0,
      type: 0,
      vehicleType: 0,
      deposit: 0,
      multiplier: 0,
      web3: null,
      operatorContracts: [],
      regulatorOwner: 0x0,
      OperatorOwner1: 0x0,
      OperatorOwner2: 0x0,
      someoneElse: 0x0,
      boothA: 0x0,
      boothB: 0x0,
      boothC: 0x0,
      startBooth: 0x0,
      endBooth: 0x0,
      routePrice: 0,
      password: 0,
      exitSecretClear: 0,
      vehicle1: 0x0,
      vehicle2: 0x0,
      exitSecretHashed: null,
      paymentPending: "no",
      finalFee: 0,
      refundWeis: 0,
      entryHistory: [],
      exitHistory: [],
    }
  }

  componentWillMount() {
    getWeb3
    .then(results => {
      this.setState({
        web3: results.web3
      })
      this.instantiateContract()
      })
      .catch(() => {
        console.log('Error finding web3.')
      })
  }

  instantiateContract() {

    let self = this
    let regulatorInstance
    const Regulator = contract(RegulatorJSON)

    Regulator.setProvider(self.state.web3.currentProvider)
    self.state.web3.eth.getAccounts((error, accounts) => {
      Regulator.deployed().then(instance => {
        regulatorInstance = instance
        self.setState({ regulatorOwner: accounts[0] })
        self.setState({ OperatorOwner1: accounts[1] })
        self.setState({ OperatorOwner2: accounts[2] })
        self.setState({ boothA:         accounts[3] })
        self.setState({ boothB:         accounts[4] })
        self.setState({ boothC:         accounts[5] })
        self.setState({ vehicle1:       accounts[6] })
        self.setState({ vehicle2:       accounts[7] })
        self.setState({ someoneElse:    accounts[8] })
        console.log(accounts)
        })
        .then(() => {
          self.setState({ regulatorContractInstance: regulatorInstance })
        })
    })
  }

  handleCreateNewOperator = () => {
    let self = this
    let addressOfNewOperator
    const tempDeposit = self.state.deposit
    const tempOwner = self.state.tempOperatorOwnerAddress
    self.setState({ currentOperatorOwnerAddress: tempOwner })
    self.setState({ deposit: 0 })
    self.setState({ tempOperatorOwnerAddress: 0x0 })
    Operator.setProvider(self.state.web3.currentProvider)
    self.state.regulatorContractInstance.createNewOperator(tempOwner, tempDeposit, { from: self.state.regulatorOwner, gas: 5000000 }).then(tx => {
      console.log(tx)
      addressOfNewOperator = tx.logs[1].args.newOperator
      newOperator = Operator.at(addressOfNewOperator)
    })
    .then(() => {
      self.setState({
        operatorContracts: [...self.state.operatorContracts, addressOfNewOperator]
      })
      self.setState({ currentOperatorContractAddress: addressOfNewOperator })
      operatorContractsList = self.state.operatorContracts.map( (i) => <li key={i.toString()}>{i}</li>)//
      self.setState({ tollBoothOperatorContractInstance: newOperator })
      return self.state.tollBoothOperatorContractInstance.setPaused(false, { from: tempOwner })
    })
    .then(() => {
      console.log("operator created.")
      self.watchLogRoadExited(self)
      self.watchLogPendingPayment(self)
    })
    .catch(error => {
      console.log("handleCreateNewOperator error:", error)
    })
  }

  handleVerifyOperator = () => {
    let self = this
    const tempAddress = self.state.tempOperatorContractAddress
    return self.state.regulatorContractInstance.isOperator.call(tempAddress, {from: self.state.regulatorOwner }).then(result => {
      console.log("handleVerifyOperator: " + result)
    })
    .catch(error => {
      console.log("handleVerifyOperator error:", error)
    })
  }

  handleSelectExistingOperator = () => {
    console.log("Setting Active Operator in Progress...")
    let self = this
    let newOperatorPending
    const tempAddress = self.state.tempOperatorContractAddress
    self.setState({ tempOperatorContractAddress: 0x0})
    self.setState({ currentOperatorContractAddress: tempAddress })
    Operator.setProvider(self.state.web3.currentProvider)
    newOperatorPending = Operator.at(tempAddress)
    newOperatorPending.then(_result => {
      newOperator = _result
      self.setState({ tollBoothOperatorContractInstance: newOperator })
      console.log("Active Operator Set: ", newOperator.address)
    })
    .catch(error => {
      console.log("handleSelectExistingOperator error:", error)
    })
  }

  handleGetVehicleType = (e) => {
    let self = this
    const tempAddress = self.state.tempVehicleAddress
    self.setState({ tempVehicleAddress: 0x0})
    return this.state.regulatorContractInstance.getVehicleType.call(tempAddress, { from: this.state.regulatorOwner })
    .then(result => {
      self.setState({ type: result.toNumber()})
      console.log("handleGetVehicleType: " + result.toString(10))
    })
    .catch(error => {
      console.log("handleGetVehicleType error:", error)
    })
  }

  handleSetVehicleType = () => {
    let self = this
    const tempAddress = self.state.tempVehicleAddress
    const tempType = self.state.type
    self.setState({ tempVehicleAddress: 0x0})
    self.setState({ type: 0})
    self.state.regulatorContractInstance.setVehicleType(tempAddress, tempType, { from: self.state.regulatorOwner })
    console.log("vehicle type set.")
  }

  handleVerifyTollBooth = () => {
    let self = this
    self.state.tollBoothOperatorContractInstance.isTollBooth.call(self.state.tempBoothAddress, { from: self.state.currentOperatorOwnerAddress })
    .then(result => {
      console.log(result)
    })
    .catch(error => {
      console.log(error)
    })
  }

  handleAddTollBooth = () => {
    let self = this
    const tempBooth = self.state.tempBoothAddress
    self.setState({ tempBoothAddress: 0x0})
    self.state.tollBoothOperatorContractInstance.addTollBooth(tempBooth, { from: self.state.currentOperatorOwnerAddress }).then(tx => {
      console.log(tx)
    })
    .catch(error => {
      console.log(error)
    })
  }

  handleSetRoutePrice = () => {
    let self = this
    if(self.state.currentOperatorOwnerAddress === 0x0) {
      console.log("You need to Activate an Operator contract!")
      return
    }
    const tempRoutePrice = self.state.routePrice
    const tempStartBooth = self.state.startBooth
    const tempEndBooth = self.state.endBooth
    self.setState({ routePrice: 0})
    self.setState({ startBooth: 0x0})
    self.setState({ endBooth: 0x0})
    self.state.tollBoothOperatorContractInstance.setRoutePrice(tempStartBooth, tempEndBooth, tempRoutePrice, { from: self.state.currentOperatorOwnerAddress})
    .then(result => {
      console.log(result)
      console.log("route price set.")
    })
    .catch(error => {
      console.log("route price error:", error)
    })
  }

  handleSetMultiplier = () => {
    let self = this
    const tempMultiplier = self.state.multiplier
    const tempVehicleType = self.state.vehicleType
    self.setState({ multiplier: 0})
    self.setState({ vehicleType: 0})
    self.state.tollBoothOperatorContractInstance.setMultiplier(tempVehicleType, tempMultiplier, { from: self.state.currentOperatorOwnerAddress }).then(tx => {
      console.log(tx)
      console.log("multiplier set.")
    })
    .catch(error => {
      console.log("multiplier error:", error)
    })
  }

  handleVehicleSelection1 = () => {
    let self = this
    self.forceUpdate()
    self.setState({ currentVehicleAddress: self.state.vehicle1 })
    self.state.web3.eth.getBalance(self.state.vehicle1, (err, _balance) => {
      if(err) console.log(err)
      self.setState({ weiBalance: _balance.toNumber() })
      const ethBalance = self.state.web3.fromWei(self.state.weiBalance, "ether")
      self.setState({ ethBalance: ethBalance })
      })
  }

  handleVehicleSelection2 = () => {
    let self = this
    self.forceUpdate()
    self.setState({ currentVehicleAddress: self.state.vehicle2 })
    self.state.web3.eth.getBalance(self.state.vehicle2, (err, _balance) => {
      if(err) console.log(err)
      self.setState({ weiBalance: _balance.toNumber() })
      const ethBalance = self.state.web3.fromWei(self.state.weiBalance, "ether")
      self.setState({ ethBalance: ethBalance })
      })
  }

  handleBoothSelectionA = (e) => {
    let self = this
    self.setState({ currentBoothAddress: self.state.boothA })
  }

  handleBoothSelectionB = () => {
    let self = this
    self.setState({ currentBoothAddress: self.state.boothB })
  }

  handleBoothSelectionC = () => {
    let self = this
    self.setState({ currentBoothAddress: self.state.boothC })
  }

  handleChange = (e) => {
    let self = this
    self.setState({ [e.target.name]: e.target.value })
  }

  handleEnterRoad = () => {
    let self = this
    let hash
    let tempPassword = self.state.password
    let tempDeposit = self.state.deposit
    self.setState({ password: 0 })
    self.setState({ deposit: 0 })
    return self.state.tollBoothOperatorContractInstance.hashSecret.call(tempPassword, { from: self.state.currentVehicleAddress })
    .then(_hash => {
      hash = _hash
      return self.state.tollBoothOperatorContractInstance.enterRoad(self.state.currentBoothAddress, hash, { from: self.state.currentVehicleAddress, value: tempDeposit, gas: 250000 })
    })
    .then(tx => {
      entryHistoryList = null
      exitHistoryList = null
      self.forceUpdate()
      console.log(tx)
      console.log("road entered.")
    })
    .catch(error => {
      console.log("road entered error:", error)
    })
  }

  handleViewHistory = () => {
    console.log("history fired.")
    let self = this
    self.setState({ entryHistory: [] })
    self.setState({ exitHistory: [] })
    entryHistoryList = null
    exitHistoryList = null
    let operator = self.state.tollBoothOperatorContractInstance;
    let entryEvent = operator.LogRoadEntered({vehicle: self.state.currentVehicleAddress}, { fromBlock: 0})
    entryEvent.watch((error, result) => {
      if(error) {
        console.log("history error: ", error)
        entryEvent.stopWatching()
      } else {
        self.setState({ entryHistory: [...self.state.entryHistory, result.args.entryBooth] })
        entryHistoryList = self.state.entryHistory.map( (a) => <li>{a}</li>)//
        self.forceUpdate()
        self.exitHistoryFilter(result.args.exitSecretHashed)
        self.pendingPaymentFilter(result.args.exitSecretHashed)
        console.log("entry booth result: ", result.args.entryBooth, result.blockNumber)
        entryEvent.stopWatching()

      }
    })
  }

  watchLogPendingPayment = (component) => {
    let self = this
    let operator = Operator.at(self.state.currentOperatorContractAddress);
    operator.LogPendingPayment( {}, { fromBlock: 0 })
    .watch(function(err, result) {
      if(err) {
        console.error('LogPendingPayment Error', err)
      } else {
        self.setState({ paymentPending: "yes"})
        self.setState({ finalFee: 0 })
        self.setState({ refundWeis: 0 })
        self.setState({ exitSecretClear: 0 })
        console.log("LogPendingPayment: ", result)
      }
    })
  }

  watchLogRoadExited = (component) => {
    let self = this
    let operator = self.state.tollBoothOperatorContractInstance
    operator.LogRoadExited( {}, { fromBlock: 0 })
    .watch(function(err, result) {
      if(err) {
        console.error('LogRoadExited Error', err)
      } else {
        self.setState({ finalFee: result.args.finalFee.toString(10)})
        self.setState({ refundWeis: result.args.refundWeis.toString(10)})
        self.setState({ paymentPending: "no" })
        console.log("result: ", result)
      }
    })
  }

  exitHistoryFilter = (_hash) => {
    let self = this
    let operator = self.state.tollBoothOperatorContractInstance
    let exitEvent = operator.LogRoadExited({exitSecretHashed: _hash}, { fromBlock: 0 })
    exitEvent.watch(function(error, result) {
      if(error) {
        console.log("exitHistoryFilter error:", error)
      } else {
        let exitBooth = result.args.exitBooth
        self.setState({
          exitHistory: [...self.state.exitHistory, exitBooth ]
        })
        exitHistoryList = self.state.exitHistory.map( (a) => <li>{a}</li>)//
        self.forceUpdate()
        exitEvent.stopWatching()
        console.log("exitHistoryFilter")
      }
    })
  }

  pendingPaymentFilter = (_hash) => {
    let self = this
    let operator = self.state.tollBoothOperatorContractInstance
    let pendingPaymentEvent = operator.LogPendingPayment({exitSecretHashed: _hash}, { fromBlock: 0 })
    pendingPaymentEvent.watch(function(error, result) {
      if(error) {
        console.log("exitHistoryFilter error:", error)
      } else {
        let exitBooth = result.args.exitBooth
        self.setState({
            exitHistory: [...self.state.exitHistory, exitBooth ]
          })
        exitHistoryList = self.state.exitHistory.map( (a) => <li>{a}</li>)//
        self.forceUpdate()
        pendingPaymentEvent.stopWatching()
        console.log("pendingPaymentFilter")
      }
    })
  }

  handleReportExitRoad = () => {
    let self = this
    self.state.tollBoothOperatorContractInstance.reportExitRoad(self.state.exitSecretClear, { from: self.state.currentBoothAddress, gas: 250000 }).then(tx => {
        console.log(tx)
        console.log("handleReportExitRoad")
    })
    .catch(error => {
      console.log('handleReportExitRoad error: ', error)
    })
  }

  render() {
    return (
      <MuiThemeProvider>
        <div className="App">
          <main className="container">
          <h1>TollRoad System Interface</h1><h3>Please select your user-type:</h3>
            <Tabs>
              <Tab label="Regulator">
                <div>
                  <h2 style={styles.headline}>Regulator Options</h2>
                  <h4> Address of Current Regulator Owner: { this.state.regulatorOwner }</h4>
                  <h4>Currently using Operator contract @: {this.state.currentOperatorContractAddress}</h4>
                  <TextField
                    name="tempOperatorOwnerAddress"
                    floatingLabelText="Set Operator Owner's Address:"
                    value={this.state.tempOperatorOwnerAddress}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <TextField
                    name="deposit"
                    floatingLabelText='Set the Deposit Amount:'
                    value={this.state.deposit}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <button className="button" onClick={ () => this.handleCreateNewOperator() }>Create New tollbooth Operator</button>
                  <br />
                  <TextField
                    name="tempOperatorContractAddress"
                    floatingLabelText='Operator Address:'
                    value={this.state.tempOperatorContractAddress}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <button className="button"  onClick={ () => this.handleVerifyOperator() }>Verify Operator</button>
                  <button className="button"  onClick={ () => this.handleSelectExistingOperator() }>Use Existing Operator Contract</button>
                   <br />
                   <TextField
                    name="tempVehicleAddress"
                    floatingLabelText='Vehicle address:'
                    value={this.state.tempVehicleAddress}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <TextField
                    name="type"
                    floatingLabelText='Type:'
                    value={this.state.type}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <button className="button" onClick={ () => this.handleGetVehicleType() }>Get Vehicle Type</button>
                  <button className="button" onClick={ () => this.handleSetVehicleType() }>Set Vehicle Type</button>
                  <br />
                  <br />
                  { " " }
                  <h4 style={styles.headline}>Existing Operator Contracts:</h4>
                  <ul>{operatorContractsList}</ul>
                </div>
              </Tab>
              <Tab label="Operator">
                <div>
                  <h2 style={styles.headline}>TollBooth Operator Options</h2>
                  <h4>Currently using Operator contract @: {this.state.currentOperatorContractAddress}</h4>
                  <TextField
                    name="tempBoothAddress"
                    floatingLabelText='TollBooth Address:'
                    value={this.state.tempBoothAddress}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <button className="button" onClick={ () => this.handleVerifyTollBooth() }>Verify TollBooth</button>
                  <button className="button" onClick={ () => this.handleAddTollBooth() }>Add TollBooth</button>
                  <br />
                  <TextField
                    name="startBooth"
                    floatingLabelText='Start Tollbooth Address:'
                    value={this.state.startBooth}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <TextField
                    name="endBooth"
                    floatingLabelText='End Tollbooth Address:'
                    value={this.state.endBooth}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <TextField
                    name="routePrice"
                    floatingLabelText='Route Price:'
                    value={this.state.routePrice}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <button className="button" onClick={ () => this.handleSetRoutePrice() }>Set Base Route Price</button>
                  <br />
                  <TextField
                    name="vehicleType"
                    floatingLabelText='Vehicle Type:'
                    value={this.state.vehicleType}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <TextField
                    name="multiplier"
                    floatingLabelText='Multiplier:'
                    value={this.state.multiplier}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <button className="button" onClick={ () => this.handleSetMultiplier() }>Set Multiplier</button>
                  <br />
                </div>
              </Tab>
              <Tab label="Vehicle">
                <div>
                  <h2 style={styles.headline}>Vehicle Options</h2>
                  <h3 >Select a Vehicle:</h3>
                  <TextField
                    name="currentVehicleAddress"
                    floatingLabelText='Set Vehicle Address:'
                    value={this.state.currentVehicleAddress}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <button className="button" name="vehicle1" onClick={ () => this.handleVehicleSelection1() }>Vehicle 1</button>
                  <button className="button" name="vehicle2" onClick={ () => this.handleVehicleSelection2() }>Vehicle 2</button>
                  <h4> Selected Vehicle Address: { this.state.currentVehicleAddress }</h4>
                  <h4> Balance in Wei: { this.state.weiBalance.toString(10) }</h4>
                  <h4> Balance in Eth: { this.state.ethBalance.toString(10) }</h4>
                  <br />
                  <h3 >Enter Road:</h3>
                  <h4 >Set the Entry Booth:</h4>
                  <TextField
                    name="currentBoothAddress"
                    floatingLabelText='Set Booth Address:'
                    value={this.state.currentBoothAddress}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <button className="button" name="boothA" onClick={this.handleBoothSelectionA.bind(this)}>TollBooth A</button>
                  <button className="button" name="boothB" onClick={ () => this.handleBoothSelectionB() }>TollBooth B</button>
                  <button className="button" name="boothC" onClick={ () => this.handleBoothSelectionC() }>TollBooth C</button>
                  <br />
                  <h4> Current TollBooth Address: { this.state.currentBoothAddress }</h4>
                  <br />
                  <TextField
                    name="deposit"
                    floatingLabelText='Amount to Deposit:'
                    value={this.state.deposit}
                    onChange={ this.handleChange.bind(this) }
                  />{ " " }
                  <TextField
                    name="password"
                    floatingLabelText='Password:'
                    value={this.state.password}
                    onChange={ this.handleChange.bind(this) }
                  />{ " " }
                  <button className="button" onClick={ () => this.handleEnterRoad() }>Make a deposit</button><br />
                  <h3>History:</h3><br />
                  <button className="button" onClick={ () => this.handleViewHistory() }>Update History</button><br />
                  <h4>Entrance Booths:</h4>
                  <br />
                  <ul>{entryHistoryList}</ul>
                  <br />
                  <h4>Exit Booths:</h4>
                  <br />
                  <ul>{exitHistoryList}</ul>
                </div>
              </Tab>
              <Tab label="TollBooth">
                <div>
                  <h2 style={styles.headline}>TollBooth Options</h2>
                  <h4 >Set the Exit Booth:</h4>
                  <TextField
                    name="currentBoothAddress"
                    floatingLabelText='Set Booth Address:'
                    value={this.state.currentBoothAddress}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <button className="button" name="boothA" onClick={ this.handleBoothSelectionA.bind(this) }>TollBooth A</button>
                  <button className="button" name="boothB" onClick={ () => this.handleBoothSelectionB() }>TollBooth B</button>
                  <button className="button" name="boothC" onClick={ () => this.handleBoothSelectionC() }>TollBooth C</button>
                  <br />
                  <h4> Current TollBooth Address: { this.state.currentBoothAddress }</h4>
                  <br/ >
                  <TextField
                    name="exitSecretClear"
                    floatingLabelText='ExitSecretClear:'
                    value={this.state.exitSecretClear}
                    onChange={this.handleChange.bind(this)}
                  />{ " " }
                  <button className="changeButton" onClick={ () => this.handleReportExitRoad() }>Report Vehicle Exit</button><br />
                  <h3 >Payment Pending :{this.state.paymentPending}</h3><br />
                  <h3 >Final Fee :{this.state.finalFee}</h3><br />
                  <h3 >Refund :{this.state.refundWeis}</h3>
                </div>
              </Tab>
              <Tab label="Addresses">
                <div>
                  <h2 style={styles.headline}>Ganache Addresses (for testing convenience)</h2>
                  <h3>Regulator Contract:</h3><h4>{ this.state.regulatorContractInstance.address}</h4>
                  <h3>Regulator Owner:</h3><h4>{ this.state.regulatorOwner}</h4>
                  <h3>Interacting with TollBoothOperator Contract @:</h3><h4>{this.state.currentOperatorContractAddress}</h4>
                  <h3>Potential Operator Owner 1:</h3><h4>{ this.state.OperatorOwner1}</h4>
                  <h3>Potential Operator Owner 2:</h3><h4>{ this.state.OperatorOwner2}</h4>
                  <h3>Some Random Person:</h3><h4>{ this.state.someoneElse}</h4>
                  <h3>Booth A:</h3><h4>{ this.state.boothA}</h4>
                  <h3>Booth B:</h3><h4>{ this.state.boothB}</h4>
                  <h3>Booth C:</h3><h4>{ this.state.boothC}</h4>
                  <h3>Vehicle 1:</h3><h4>{ this.state.vehicle1}</h4>
                  <h3>Vehicle 2:</h3><h4>{ this.state.vehicle2}</h4>
                </div>
              </Tab>
            </Tabs>
          </main>
        </div>
      </MuiThemeProvider>
    );
  }
}

export default App
