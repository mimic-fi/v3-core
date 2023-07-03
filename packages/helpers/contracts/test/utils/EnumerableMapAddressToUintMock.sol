// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../utils/EnumerableMap.sol';

// solhint-disable func-name-mixedcase

contract EnumerableMapAddressToUintMock {
    using EnumerableMap for EnumerableMap.AddressToUintMap;

    event OperationResult(bool result);

    EnumerableMap.AddressToUintMap private _map;

    function set(address key, uint256 value) public {
        bool result = _map.set(key, value);
        emit OperationResult(result);
    }

    function remove(address key) public {
        bool result = _map.remove(key);
        emit OperationResult(result);
    }

    function length() public view returns (uint256) {
        return _map.length();
    }

    function contains(address key) public view returns (bool) {
        return _map.contains(key);
    }

    function at(uint256 index) public view returns (address key, uint256 value) {
        return _map.at(index);
    }

    function get(address key) public view returns (uint256) {
        return _map.get(key);
    }

    function tryGet(address key) public view returns (bool exists, uint256 value) {
        return _map.tryGet(key);
    }

    function keys() public view returns (address[] memory) {
        return _map.keys();
    }

    function values() public view returns (uint256[] memory) {
        return _map.values();
    }
}
