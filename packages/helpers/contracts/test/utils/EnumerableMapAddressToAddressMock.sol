// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../utils/EnumerableMap.sol';

// solhint-disable func-name-mixedcase

contract EnumerableMapAddressToAddressMock {
    using EnumerableMap for EnumerableMap.AddressToAddressMap;

    event OperationResult(bool result);

    EnumerableMap.AddressToAddressMap private _map;

    function length() public view returns (uint256) {
        return _map.length();
    }

    function contains(address key) public view returns (bool) {
        return _map.contains(key);
    }

    function set(address key, address value) public {
        bool result = _map.set(key, value);
        emit OperationResult(result);
    }

    function remove(address key) public {
        bool result = _map.remove(key);
        emit OperationResult(result);
    }

    function at(uint256 index) public view returns (address key, address value) {
        return _map.at(index);
    }

    function get(address key) public view returns (address) {
        return _map.get(key);
    }

    function tryGet(address key) public view returns (bool exists, address value) {
        return _map.tryGet(key);
    }

    function keys() public view returns (address[] memory) {
        return _map.keys();
    }

    function values() public view returns (address[] memory) {
        return _map.values();
    }
}
