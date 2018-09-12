pragma solidity ^0.4.13;

import "./Owned.sol";
import "./Pausable.sol";
import "./Regulated.sol";
import "./DepositHolder.sol";
import "./MultiplierHolder.sol";
import "./RoutePriceHolder.sol";
import "./interfaces/TollBoothOperatorI.sol";
import "./interfaces/RegulatorI.sol";

contract TollBoothOperator is Owned, Pausable, Regulated, DepositHolder, MultiplierHolder, RoutePriceHolder, TollBoothOperatorI {

    uint collectedFees;

    struct TravelDetails {
        address vehicle;
        address entryBooth;
        uint deposit;
        address exitBooth;
        uint multiplier;
    }

    mapping(bytes32 => TravelDetails) tripData;
    mapping(address => mapping(address => uint)) pendingPayments;
    mapping(bytes32 => bool) usedHashes;
    bytes32[] hashedExitSecrets;

    function TollBoothOperator(bool _isPaused, uint _deposit, address _regulator )
        Pausable(_isPaused)
        DepositHolder(_deposit)
        Regulated(_regulator)
    {
        require(_regulator != 0);
    }

    function hashSecret(bytes32 secret)
        constant
        public
        returns(bytes32 hashed)
    {
        return keccak256(secret);
    }


// A previously used exitSecretHashed cannot be used ever again.
// consider:


    function enterRoad(
            address entryBooth,
            bytes32 exitSecretHashed)
        whenNotPaused
        public
        payable
        returns (bool success)
    {
        require(isTollBooth(entryBooth));
        require(!usedHashes[exitSecretHashed]);
        usedHashes[exitSecretHashed] = true;
        RegulatorI regulator = getRegulator();
        uint vehicleType = regulator.getVehicleType(msg.sender);
        uint multiplier = getMultiplier(vehicleType);
        tripData[exitSecretHashed].multiplier = multiplier;
        require(msg.value >= getDeposit() * getMultiplier(vehicleType));
        tripData[exitSecretHashed].vehicle = msg.sender;
        tripData[exitSecretHashed].entryBooth = entryBooth;
        tripData[exitSecretHashed].deposit += msg.value;
        LogRoadEntered(msg.sender, entryBooth, exitSecretHashed, msg.value);
        return true;
    }

    function getVehicleEntry(bytes32 exitSecretHashed)
        constant
        public
        returns(
            address vehicle,
            address entryBooth,
            uint depositedWeis)
    {
        return(tripData[exitSecretHashed].vehicle, tripData[exitSecretHashed].entryBooth, tripData[exitSecretHashed].deposit);
    }

    function reportExitRoad(bytes32 exitSecretClear)
        whenNotPaused
        public
        returns (uint status)
    {
       require(isTollBooth(msg.sender));
       bytes32 hash = hashSecret(exitSecretClear);
       address vehicle;
       address entryBooth;
       uint depositedWeis;
       (vehicle, entryBooth, depositedWeis) = getVehicleEntry(hash);
       require(msg.sender != entryBooth);
       require(vehicle != 0x0);
       uint amountDeposited = (depositedWeis);
       RegulatorI regulator = getRegulator();
       uint routeFee = getRoutePrice(entryBooth, msg.sender) * getMultiplier(regulator.getVehicleType(vehicle));
       uint finalFee;
       uint refund;
       if(routeFee == 0) {
           tripData[hash].exitBooth = msg.sender;
           pendingPayments[tripData[hash].entryBooth][msg.sender]++;
           hashedExitSecrets.push(hash);
           LogPendingPayment(hashSecret(exitSecretClear), tripData[hash].entryBooth, msg.sender);
           return 2;
       } else
           if(routeFee >= amountDeposited) {
               finalFee = amountDeposited;
               refund = 0;
           } else {
               finalFee = routeFee;
               refund = amountDeposited - routeFee;
           }
           collectedFees += finalFee;
           tripData[hash].deposit = 0;
           LogRoadExited(msg.sender, hashSecret(exitSecretClear), finalFee, refund);
           if(refund > 0) {
               uint amount = refund;
               refund = 0;
               tripData[hash].vehicle.transfer(amount);
           }
           return 1;
    }

    function getPendingPaymentCount(address entryBooth, address exitBooth)
        constant
        public
        returns (uint count)
    {
        // bytes32 routeHash = keccak256(entryBooth, exitBooth);
        return pendingPayments[entryBooth][exitBooth];
    }

    function clearSomePendingPayments(
            address entryBooth,
            address exitBooth,
            uint count)
        whenNotPaused
        public
        returns (bool success)
    {
        require(isTollBooth(entryBooth) && isTollBooth(exitBooth));
        require(getPendingPaymentCount(entryBooth, exitBooth) >= count);
        require(count != 0);
        RegulatorI regulator = getRegulator();
        // Not FIFO yet!
        for (uint i = 0; i < count; i++) {
            bytes32 exitSecret = hashedExitSecrets[0];
            for (uint n = 0; n < hashedExitSecrets.length - 1; n++) {
                hashedExitSecrets[n] = hashedExitSecrets[n + 1];
            }
            delete hashedExitSecrets[hashedExitSecrets.length - 1];
            hashedExitSecrets.length--;
            address vehicle;
            uint amountDeposited;
            (vehicle, , amountDeposited) = getVehicleEntry(exitSecret);
            uint routeFee = getRoutePrice(entryBooth, exitBooth) * getMultiplier(regulator.getVehicleType(vehicle));
            uint finalFee;
            uint refund;
            if(routeFee > amountDeposited) {
               finalFee = amountDeposited;
               refund = 0;
            } else {
               finalFee = routeFee;
               refund = amountDeposited - routeFee;
            }
            tripData[exitSecret].deposit = 0;
            pendingPayments[entryBooth][exitBooth]--;
            collectedFees += finalFee;
            LogRoadExited(exitBooth, exitSecret, finalFee, refund);
            if(refund > 0) {
                uint amount = refund;
                refund = 0;
                tripData[exitSecret].vehicle.transfer(amount);
            }
            return true;
        }

        return true;
    }

    function getCollectedFeesAmount()
        constant
        public
        returns(uint amount)
    {
        return collectedFees;
    }

    function withdrawCollectedFees()
        fromOwner
        public
        returns(bool success)
    {
        require(collectedFees != 0);
        LogFeesCollected(getOwner(), collectedFees);
        uint amount = collectedFees;
        collectedFees = 0;
        msg.sender.transfer(amount);
        return true;
    }

    function() {
        require(msg.sender == 0);
    }
}