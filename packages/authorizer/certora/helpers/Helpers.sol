// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

contract Helpers {
    function authParams(address p1, address p2, bytes4 p3) external pure returns (uint256[] memory r) {
        r = new uint256[](3);
        r[0] = uint256(uint160(p1));
        r[1] = uint256(uint160(p2));
        r[2] = uint256(uint32(p3));
    }
}
