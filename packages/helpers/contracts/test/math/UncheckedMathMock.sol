// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../math/UncheckedMath.sol';

contract UncheckedMathMock {
    using UncheckedMath for int256;
    using UncheckedMath for uint256;

    function add(uint256 a, uint256 b) external pure returns (uint256) {
        return a.uncheckedAdd(b);
    }

    function sub(uint256 a, uint256 b) external pure returns (uint256) {
        return a.uncheckedSub(b);
    }

    function mul(uint256 a, uint256 b) external pure returns (uint256) {
        return a.uncheckedMul(b);
    }

    function mulInt(int256 a, int256 b) external pure returns (int256) {
        return a.uncheckedMul(b);
    }

    function div(uint256 a, uint256 b) external pure returns (uint256) {
        return a.uncheckedDiv(b);
    }
}
