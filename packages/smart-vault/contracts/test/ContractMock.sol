// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract ContractMock {
    event Received(address indexed sender, uint256 value);

    function call() external payable {
        emit Received(msg.sender, msg.value);
    }
}
