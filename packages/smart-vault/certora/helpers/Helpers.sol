// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

contract Helpers {
    function nativeBalanceOf(address account) external view returns (uint256) {
        return address(account).balance;
    }
}
