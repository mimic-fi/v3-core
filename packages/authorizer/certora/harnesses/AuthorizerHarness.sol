// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.17;

import '../../contracts/Authorizer.sol';

contract AuthorizerHarness is Authorizer {
    constructor() {
        // solhint-disable-previous-line no-empty-blocks
    }

    function changePermissions(
        address where,
        bool withGrant,
        address grantWho,
        bytes4 grantWhat,
        bool withRevoke,
        address revokeWho,
        bytes4 revokeWhat
    ) external {
        IAuthorizer.PermissionChange[] memory changes;
        changes[0].where = where;

        if (withGrant) {
            changes[0].grants[0].who = grantWho;
            changes[0].grants[0].what = grantWhat;
        }

        if (withRevoke) {
            changes[0].revokes[0].who = revokeWho;
            changes[0].revokes[0].what = revokeWhat;
        }

        changePermissions(changes);
    }
}
