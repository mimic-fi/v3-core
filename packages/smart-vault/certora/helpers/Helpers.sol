// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract Helpers {
    address public constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function balanceOf(address token, address account) external view returns (uint256) {
        if (token == NATIVE_TOKEN) return address(account).balance;
        else return IERC20(token).balanceOf(address(account));
    }

    function authParams(address p1, address p2, uint256 p3) external pure returns (uint256[] memory r) {
        r = new uint256[](3);
        r[0] = uint256(uint160(p1));
        r[1] = uint256(uint160(p2));
        r[2] = p3;
    }

    function authParams(address p1) external pure returns (uint256[] memory r) {
        r = new uint256[](1);
        r[0] = uint256(uint160(p1));
    }
}
