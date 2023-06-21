// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.17;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import './AuthorizedHelpers.sol';
import './interfaces/IAuthorizer.sol';

/**
 * @title Authorizer
 * @dev Authorization mechanism based on permissions
 */
contract Authorizer is IAuthorizer, AuthorizedHelpers, Initializable, ReentrancyGuardUpgradeable {
    // Constant used to denote that a permission is open to anyone
    address public constant ANYONE = address(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);

    // Constant used to denote that a permission is open to anywhere
    address public constant ANYWHERE = address(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);

    // Param logic op types
    enum Op {
        NONE,
        EQ,
        NEQ,
        GT,
        LT,
        GTE,
        LTE
    }

    /**
     * @dev Permission data information
     * @param authorized Whether it is authorized or not
     * @param params List of params defined for each permission
     */
    struct Permission {
        bool authorized;
        Param[] params;
    }

    // List of permissions indexed by who => where => what
    mapping (address => mapping (address => mapping (bytes4 => Permission))) private _permissions;

    /**
     * @dev Creates a new authorizer contract. Note that initializers are disabled at creation time.
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialization function.
     * @param owners List of addresses that will be allowed to authorize and unauthorize permissions
     */
    function initialize(address[] memory owners) external initializer {
        __ReentrancyGuard_init();
        for (uint256 i = 0; i < owners.length; i++) {
            _authorize(owners[i], address(this), IAuthorizer.authorize.selector, new Param[](0));
            _authorize(owners[i], address(this), IAuthorizer.unauthorize.selector, new Param[](0));
        }
    }

    /**
     * @dev Tells whether `who` is allowed to call `what` on `where` with `how`
     * @param who Address asking permission for
     * @param where Target address asking permission for
     * @param what Function selector asking permission for
     * @param how Params asking permission for
     */
    function isAuthorized(address who, address where, bytes4 what, uint256[] memory how)
        public
        view
        override
        returns (bool)
    {
        if (_isAuthorized(who, where, what, how)) return true; // direct permission
        if (_isAuthorized(ANYONE, where, what, how)) return true; // anyone is allowed
        if (_isAuthorized(who, ANYWHERE, what, how)) return true; // direct permission on anywhere
        if (_isAuthorized(ANYONE, ANYWHERE, what, how)) return true; // anyone allowed anywhere
        return false;
    }

    /**
     * @dev Tells the params set for a given permission
     * @param who Address asking permission params of
     * @param where Target address asking permission params of
     * @param what Function selector asking permission params of
     */
    function getPermissionParams(address who, address where, bytes4 what)
        external
        view
        override
        returns (Param[] memory)
    {
        return _permissions[who][where][what].params;
    }

    /**
     * @dev Executes a list of permission changes. Sender must be authorized.
     * @param changes List of permission changes to be executed
     */
    function changePermissions(PermissionChange[] memory changes) external override {
        for (uint256 i = 0; i < changes.length; i++) {
            PermissionChange memory change = changes[i];
            for (uint256 j = 0; j < change.grants.length; j++) {
                GrantPermission memory grant = change.grants[j];
                authorize(grant.who, change.where, grant.what, grant.params);
            }
            for (uint256 j = 0; j < change.revokes.length; j++) {
                RevokePermission memory revoke = change.revokes[j];
                unauthorize(revoke.who, change.where, revoke.what);
            }
        }
    }

    /**
     * @dev Authorizes `who` to call `what` on `where` restricted by `params`. Sender must be authorized.
     * @param who Address to be authorized
     * @param where Target address to be granted for
     * @param what Function selector to be granted
     * @param params Optional params to restrict a permission attempt
     */
    function authorize(address who, address where, bytes4 what, Param[] memory params) public override nonReentrant {
        uint256[] memory how = authParams(who, where, what);
        bool allowed = isAuthorized(msg.sender, address(this), IAuthorizer.authorize.selector, how);
        require(allowed, 'AUTHORIZER_SENDER_NOT_ALLOWED');
        _authorize(who, where, what, params);
    }

    /**
     * @dev Unauthorizes `who` to call `what` on `where`. Sender must be authorized.
     * @param who Address to be authorized
     * @param where Target address to be revoked for
     * @param what Function selector to be revoked
     */
    function unauthorize(address who, address where, bytes4 what) public override nonReentrant {
        uint256[] memory how = authParams(who, where, what);
        bool allowed = isAuthorized(msg.sender, address(this), IAuthorizer.unauthorize.selector, how);
        require(allowed, 'AUTHORIZER_SENDER_NOT_ALLOWED');
        _unauthorize(who, where, what);
    }

    /**
     * @dev Tells whether `who` is allowed to call `what` on `where` with `how`
     * @param who Address asking permission for
     * @param where Target address asking permission for
     * @param what Function selector asking permission for
     * @param how Params asking permission for
     */
    function _isAuthorized(address who, address where, bytes4 what, uint256[] memory how) internal view returns (bool) {
        Permission storage permission = _permissions[who][where][what];
        return permission.authorized && _evalParams(permission.params, how);
    }

    /**
     * @dev Authorizes `who` to call `what` on `where` restricted by `params`
     * @param who Address to be authorized
     * @param where Target address to be granted for
     * @param what Function selector to be granted
     * @param params Optional params to restrict a permission attempt
     */
    function _authorize(address who, address where, bytes4 what, Param[] memory params) internal {
        Permission storage permission = _permissions[who][where][what];
        permission.authorized = true;
        delete permission.params;
        for (uint256 i = 0; i < params.length; i++) permission.params.push(params[i]);
        emit Authorized(who, where, what, params);
    }

    /**
     * @dev Unauthorizes `who` to call `what` on `where`
     * @param who Address to be authorized
     * @param where Target address to be revoked for
     * @param what Function selector to be revoked
     */
    function _unauthorize(address who, address where, bytes4 what) internal {
        delete _permissions[who][where][what];
        emit Unauthorized(who, where, what);
    }

    /**
     * @dev Evaluates a list of params defined for a permission against a list of values given by a call
     * @param params List of expected params
     * @param how List of actual given values
     * @return True if all the given values hold against the list of params
     */
    function _evalParams(Param[] memory params, uint256[] memory how) private pure returns (bool) {
        for (uint256 i = 0; i < params.length; i++) {
            Param memory param = params[i];
            if ((i < how.length && !_evalParam(param, how[i])) || (i >= how.length && Op(param.op) != Op.NONE)) {
                return false;
            }
        }
        return true;
    }

    /**
     * @dev Evaluates a single param defined for a permission against a single value
     * @param param Expected params
     * @param how Actual given value
     * @return True if the given value hold against the expected param
     */
    function _evalParam(Param memory param, uint256 how) private pure returns (bool) {
        if (Op(param.op) == Op.NONE) return true;
        if (Op(param.op) == Op.EQ) return how == param.value;
        if (Op(param.op) == Op.NEQ) return how != param.value;
        if (Op(param.op) == Op.GT) return how > param.value;
        if (Op(param.op) == Op.LT) return how < param.value;
        if (Op(param.op) == Op.GTE) return how >= param.value;
        if (Op(param.op) == Op.LTE) return how <= param.value;
        revert('AUTHORIZER_INVALID_PARAM_OP');
    }
}
