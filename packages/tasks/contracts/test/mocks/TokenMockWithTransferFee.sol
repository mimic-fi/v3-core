// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract TokenMockWithTransferFee is ERC20 {
    uint8 internal _fee;

    constructor(string memory symbol, uint8 fee) ERC20(symbol, symbol) {
        _fee = fee;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal virtual override {
        super._transfer(from, to, amount * (100 - _fee) / 100);
    }
}
