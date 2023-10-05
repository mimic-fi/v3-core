// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

import '@mimic-fi/v3-authorizer/contracts/interfaces/IAuthorizer.sol';
import '@mimic-fi/v3-helpers/contracts/utils/Denominations.sol';
import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

contract Helpers {
    function NATIVE_TOKEN() external pure returns (address) {
        return Denominations.NATIVE_TOKEN;
    }

    function balanceOf(address token, address account) external view returns (uint256) {
        return ERC20Helpers.balanceOf(token, account);
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

    function getPermissionParamsLength(address authorizer, address who, address where, bytes4 what)
        external
        view
        returns (uint256)
    {
        IAuthorizer.Param[] memory permissionParams = IAuthorizer(authorizer).getPermissionParams(who, where, what);
        return permissionParams.length;
    }
}
