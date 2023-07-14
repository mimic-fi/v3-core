// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../Authorized.sol';

contract AuthorizedMock is Authorized {
    event LogUint256(uint256 x);
    event LogBytes32(bytes32 x);
    event LogAddress(address x);

    function initialize(address _authorizer) external virtual initializer {
        __Authorized_init(_authorizer);
    }

    function setUint256(uint256 x) external authP(authParams(x)) {
        emit LogUint256(x);
    }

    function setBytes32(bytes32 x) external authP(authParams(x)) {
        emit LogBytes32(x);
    }

    function setAddress(address x) external authP(authParams(x)) {
        emit LogAddress(x);
    }
}
