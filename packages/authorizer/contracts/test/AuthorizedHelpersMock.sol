// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../AuthorizedHelpers.sol';

contract AuthorizedHelpersMock is AuthorizedHelpers {
    function getAuthParams(address p1) external pure returns (uint256[] memory r) {
        return authParams(p1);
    }

    function getAuthParams(bytes32 p1) external pure returns (uint256[] memory r) {
        return authParams(p1);
    }

    function getAuthParams(uint256 p1) external pure returns (uint256[] memory r) {
        return authParams(p1);
    }

    function getAuthParams(address p1, bool p2) external pure returns (uint256[] memory r) {
        return authParams(p1, p2);
    }

    function getAuthParams(address p1, uint256 p2) external pure returns (uint256[] memory r) {
        return authParams(p1, p2);
    }

    function getAuthParams(address p1, address p2) external pure returns (uint256[] memory r) {
        return authParams(p1, p2);
    }

    function getAuthParams(bytes32 p1, bytes32 p2) external pure returns (uint256[] memory r) {
        return authParams(p1, p2);
    }

    function getAuthParams(address p1, address p2, uint256 p3) external pure returns (uint256[] memory r) {
        return authParams(p1, p2, p3);
    }

    function getAuthParams(address p1, address p2, address p3) external pure returns (uint256[] memory r) {
        return authParams(p1, p2, p3);
    }

    function getAuthParams(address p1, address p2, bytes4 p3) external pure returns (uint256[] memory r) {
        return authParams(p1, p2, p3);
    }

    function getAuthParams(address p1, uint256 p2, uint256 p3) external pure returns (uint256[] memory r) {
        return authParams(p1, p2, p3);
    }

    function getAuthParams(address p1, address p2, uint256 p3, uint256 p4) external pure returns (uint256[] memory r) {
        return authParams(p1, p2, p3, p4);
    }

    function getAuthParams(address p1, uint256 p2, uint256 p3, uint256 p4) external pure returns (uint256[] memory r) {
        return authParams(p1, p2, p3, p4);
    }

    function getAuthParams(bytes32 p1, address p2, uint256 p3, bool p4) external pure returns (uint256[] memory r) {
        return authParams(p1, p2, p3, p4);
    }

    function getAuthParams(address p1, uint256 p2, uint256 p3, uint256 p4, uint256 p5)
        external
        pure
        returns (uint256[] memory r)
    {
        return authParams(p1, p2, p3, p4, p5);
    }
}
