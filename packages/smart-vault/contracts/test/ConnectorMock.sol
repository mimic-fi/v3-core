// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './ContractMock.sol';

contract ConnectorMock {
    ContractMock public immutable mock;

    constructor() {
        mock = new ContractMock();
    }

    function call() external payable {
        // solhint-disable-next-line avoid-low-level-calls
        mock.call();
    }
}
