// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract FeedMock {
    uint8 public decimals;
    int256 public price;

    constructor(int256 _price, uint8 _decimals) {
        price = _price;
        decimals = _decimals;
    }

    function latestRoundData() external view returns (uint80, int256 answer, uint256, uint256, uint80) {
        return (0, price, 0, 0, 0);
    }
}
