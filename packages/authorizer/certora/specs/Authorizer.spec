import "./General.spec";

using Helpers as helpers;

methods {
    // Helpers
    function helpers.authParams(address,address,bytes4) external returns (uint256[]) envfree;

    // Authorizer
    function isAuthorized(address,address,bytes4,uint256[]) external returns (bool) envfree;
}

use rule sanity;

use rule reentrancyGuard filtered {
    f -> 
        !f.isView
        && f.selector != sig:changePermissions(IAuthorizer.PermissionChange[]).selector
        && f.selector != sig:initialize(address[]).selector
}

rule senderMustBeAuthorizedToAuthorizeOthers(env e, address who, address where, bytes4 what, IAuthorizer.Param[] params)
    good_description "Only authorized users can authorize other users"
{
    // TODO: changePermissions
    bytes4 sigAuthorize = to_bytes4(sig:authorize(address, address, bytes4, IAuthorizer.Param[]).selector);
    uint256[] how = helpers.authParams(who, where, what);
    bool senderCanAuthorize = isAuthorized(e.msg.sender, currentContract, sigAuthorize, how);

    authorize(e, who, where, what, params);

    assert senderCanAuthorize;
}

rule senderMustBeAuthorizedToUnauthorizeOthers(env e, address who, address where, bytes4 what)
    good_description "Only authorized users can unauthorize other users"
{
    // TODO: changePermissions
    bytes4 sigAuthorize = to_bytes4(sig:unauthorize(address, address, bytes4).selector);
    uint256[] how = helpers.authParams(who, where, what);
    bool senderCanUnauthorize = isAuthorized(e.msg.sender, currentContract, sigAuthorize, how);

    unauthorize(e, who, where, what);

    assert senderCanUnauthorize;
}

rule otherFunctionsCannotAuthorize(env e, method f, calldataarg args, address who, address where, bytes4 what)
    filtered {
        f -> 
            !f.isView
            && f.selector != sig:authorize(address, address, bytes4, IAuthorizer.Param[]).selector
            && f.selector != sig:changePermissions(IAuthorizer.PermissionChange[]).selector
            && f.selector != sig:initialize(address[]).selector
    }
    good_description "Permissions can only be granted by authorize or changePermissions functions"
{
    uint256[] how = helpers.authParams(who, where, what);
    bool authorizedBefore = isAuthorized(who, where, what, how);

    f(e, args);

    bool authorizedAfter = isAuthorized(who, where, what, how);

    assert !authorizedBefore => !authorizedAfter;
}
