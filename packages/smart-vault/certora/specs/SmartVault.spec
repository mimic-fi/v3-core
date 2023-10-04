import "./General.spec";

using Helpers as helpers;
using WrappedNativeTokenMock as WrappedNativeTokenMock;
using Authorizer as Authorizer;
using FeeController as FeeController;
using Registry as Registry;

// METHODS
methods {
    // Helpers
    function helpers.NATIVE_TOKEN() external returns (address) envfree => ALWAYS(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    function helpers.balanceOf(address,address) external returns (uint256) envfree;
    function helpers.authParams(address) external returns (uint256[]) envfree;
    function helpers.authParams(address,address,uint256) external returns (uint256[]) envfree;
    function helpers.getPermissionParamsLength(address,address,address,bytes4) external returns (uint256) envfree;

    // Wrapped native token mock
    function WrappedNativeTokenMock.deposit() external;
    function WrappedNativeTokenMock.withdraw(uint256) external;
    function _.balanceOf(address) external => DISPATCHER(true);
    function _.transfer(address,uint256) external => DISPATCHER(true);
    function _.transferFrom(address,address,uint256) external => DISPATCHER(true);

    // Authorizer
    function Authorizer.ANYONE() external returns (address) envfree => ALWAYS(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);
    function Authorizer.ANYWHERE() external returns (address) envfree => ALWAYS(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);
    function Authorizer.isAuthorized(address,address,bytes4,uint256[]) external returns (bool) envfree;
    function Authorizer.hasPermission(address,address,bytes4) external returns (bool) envfree;
    function _.getPermissionParams(address,address,bytes4) external => DISPATCHER(true);

    // Fee controller
    function FeeController.getFee(address) external returns (uint256,uint256,address) envfree;

    // Registry
    function Registry.isRegistered(address) external returns (bool) envfree;
    function Registry.isStateless(address) external returns (bool) envfree;
    function Registry.isDeprecated(address) external returns (bool) envfree;

    // Smart vault
    function authorizer() external returns (address) envfree;
    function isPaused() external returns (bool) envfree;
    function priceOracle() external returns (address) envfree;
    function feeController() external returns (address) envfree;
    function wrappedNativeToken() external returns (address) envfree;
    function isConnectorCheckIgnored(address) external returns (bool) envfree;
    function getBalanceConnector(bytes32,address) external returns (uint256) envfree;

    // Call
    function _.functionDelegateCall(address,bytes,string) external => NONDET DELETE(true);
    function _.functionCallWithValue(address,bytes,uint256,string) external => NONDET DELETE(true);
}

// DEFINITIONS
// Constants
definition FIXED_POINT_ONE() returns uint256 = 10^18;
definition MAX_UINT256() returns mathint = 2^256 - 1;

// Signatures
definition INITIALIZE() returns uint32 = sig:initialize(address, address).selector;
definition PAUSE() returns uint32 = sig:pause().selector;
definition UNPAUSE() returns uint32 = sig:unpause().selector;
definition SET_PRICE_ORACLE() returns uint32 = sig:setPriceOracle(address).selector;
definition OVERRIDE_CONNECTOR_CHECK() returns uint32 = sig:overrideConnectorCheck(address, bool).selector;
definition UPDATE_BALANCE_CONNECTOR() returns uint32 = sig:updateBalanceConnector(bytes32, address, uint256, bool).selector;
definition EXECUTE() returns uint32 = sig:execute(address, bytes).selector;
definition CALL_SIG() returns uint32 = sig:call(address, bytes, uint256).selector;
definition WRAP() returns uint32 = sig:wrap(uint256).selector;
definition UNWRAP() returns uint32 = sig:unwrap(uint256).selector;
definition COLLECT() returns uint32 = sig:collect(address, address, uint256).selector;
definition WITHDRAW() returns uint32 = sig:withdraw(address, address, uint256).selector;

// FUNCTIONS
function requireValidFeeCollector() {
    uint256 maxPct;
    uint256 pct;
    address collector;
    maxPct, pct, collector = FeeController.getFee(currentContract);
    require maxPct <= FIXED_POINT_ONE()
        && pct <= maxPct
        && collector != currentContract;
}

function requireValidFeeCollectorWithOverflowCheck(uint256 amount, address token) {
    uint256 maxPct;
    uint256 pct;
    address collector;
    maxPct, pct, collector = FeeController.getFee(currentContract);
    require maxPct <= FIXED_POINT_ONE()
        && pct <= maxPct
        && amount * pct <= MAX_UINT256()
        && collector != currentContract;
    
    uint256 collectorBalance = helpers.balanceOf(token, collector);
    require collectorBalance + amount <= MAX_UINT256();
}

function isValidConnector(address connector) returns bool {
    return Registry.isRegistered(connector)
        && Registry.isStateless(connector)
        && !Registry.isDeprecated(connector);
}

function requireEmptyParams(address who, address where, bytes4 what) {
    require helpers.getPermissionParamsLength(authorizer(), who, where, what) == 0;
}

function requireNonGenericPermissions(address who, address where, bytes4 what) {
    require !Authorizer.hasPermission(Authorizer.ANYONE(), where, what);
    require !Authorizer.hasPermission(who, Authorizer.ANYWHERE(), what);
    require !Authorizer.hasPermission(Authorizer.ANYONE(), Authorizer.ANYWHERE(), what);
}

// RULES
use rule sanity;

use rule reentrancyGuard filtered {
    f -> 
        !f.isView
        && !f.isFallback
        && f.selector != INITIALIZE()
        && f.selector != PAUSE()
        && f.selector != UNPAUSE()
}

rule canOnlyCallUnpause(env e, method f, calldataarg args)
    filtered { 
        f ->
            !f.isView
            && !f.isFallback
            && f.selector != INITIALIZE()
    }
    good_description "If the smart vault is paused, then we cannot call any non-view function except for unpause"
{
    require isPaused();

    f@withrevert(e, args);

    assert lastReverted || f.selector == UNPAUSE();
}

rule stillUnpaused(env e) good_description "Calling pause and then unpause should leave the smart vault unpaused" {
    require !isPaused();
    pause(e);
    unpause(e);
    assert !isPaused();
}

rule stillPaused(env e) good_description "Calling unpause and then pause should leave the smart vault paused" {
    require isPaused();
    unpause(e);
    pause(e);
    assert isPaused();
}

rule setPriceOracleOnly(env e, method f, calldataarg args)
    filtered {
        f -> 
            !f.isView
            && f.selector != INITIALIZE()
            && f.selector != EXECUTE() // It should be excluded as there's no way to dispatch `delegateCall`, and an unresolved call can change the storage
            && f.selector != SET_PRICE_ORACLE()
    }
    good_description "The only method that can modify `priceOracle` reference is `setPriceOracle`"
{
    address initPriceOracle = priceOracle();

    f(e, args);
    
    assert priceOracle() == initPriceOracle;
}

rule overrideConnectorCheckOnly(env e, method f, calldataarg args, address connector)
    filtered {
        f -> 
            !f.isView
            && f.selector != EXECUTE() // It should be excluded as there's no way to dispatch `delegateCall`, and an unresolved call can change the storage
            && f.selector != OVERRIDE_CONNECTOR_CHECK()
    }
    good_description "The only method that can modify `isConnectorCheckIgnored` values is `overrideConnectorCheck`"
{
    bool initIgnored = isConnectorCheckIgnored(connector);

    f(e, args);

    assert isConnectorCheckIgnored(connector) == initIgnored;
}

rule updateBalanceConnectorOnly(env e, method f, calldataarg args, bytes32 id, address token)
    filtered {
        f -> 
            !f.isView
            && f.selector != EXECUTE() // It should be excluded as there's no way to dispatch `delegateCall`, and an unresolved call can change the storage
            && f.selector != UPDATE_BALANCE_CONNECTOR()
    }
    good_description "The only method that can modify balances connectors is `updateBalanceConnector`"
{
    uint256 initBalanceConnector = getBalanceConnector(id, token);

    f(e, args);

   assert getBalanceConnector(id, token) == initBalanceConnector;
}

rule increaseAndDecreaseShouldNotChangeBalanceConnector(env e, bytes32 id, address token, uint256 amount)
    good_description "Calling `updateBalanceConnector` twice with opposite `amount` values should not change the connector balance"
{
    uint256 initBalanceConnector = getBalanceConnector(id, token);

    updateBalanceConnector(e, id, token, amount, true);
    updateBalanceConnector(e, id, token, amount, false);

    uint256 currentBalanceConnector = getBalanceConnector(id, token);
    assert initBalanceConnector == currentBalanceConnector;
}

rule wrapUnwrapIntegrity(env e, uint256 amount)
    good_description "Calling `wrap` and then `unwrap` should not change the storage"
{
    storage initStorage = lastStorage;

    wrap(e, amount);
    unwrap(e, amount);

    storage currentStorage = lastStorage;
    assert initStorage[currentContract] == currentStorage[currentContract];
}

rule unwrapWrapIntegrity(env e, uint256 amount)
    good_description "Calling `unwrap` and then `wrap` should not change the storage"
{
    storage initStorage = lastStorage;

    unwrap(e, amount);
    wrap(e, amount);

    storage currentStorage = lastStorage;
    assert initStorage[currentContract] == currentStorage[currentContract];
}

rule wrapProperBalances(env e, uint256 amount)
    good_description "After wrapping an `amount` of native tokens, the smart vault balance in wrapped and native token should respectively increase and decrease by that `amount`"
{
    require wrappedNativeToken() != helpers.NATIVE_TOKEN();

    uint256 initNativeBalance = helpers.balanceOf(helpers.NATIVE_TOKEN(), currentContract);
    uint256 initWrappedBalance = helpers.balanceOf(wrappedNativeToken(), currentContract);

    wrap(e, amount);

    uint256 currentNativeBalance = helpers.balanceOf(helpers.NATIVE_TOKEN(), currentContract);
    uint256 currentWrappedBalance = helpers.balanceOf(wrappedNativeToken(), currentContract);
    
    assert to_mathint(currentNativeBalance) == initNativeBalance - amount;
    assert to_mathint(currentWrappedBalance) == initWrappedBalance + amount;
}

rule unwrapProperBalances(env e, uint256 amount)
    good_description "After unwrapping an `amount` of wrapped native tokens, the smart vault balance in wrapped and native token should respectively decrease and increase by that `amount`"
{
    require wrappedNativeToken() != helpers.NATIVE_TOKEN();

    uint256 initNativeBalance = helpers.balanceOf(helpers.NATIVE_TOKEN(), currentContract);
    uint256 initWrappedBalance = helpers.balanceOf(wrappedNativeToken(), currentContract);

    unwrap(e, amount);

    uint256 currentNativeBalance = helpers.balanceOf(helpers.NATIVE_TOKEN(), currentContract);
    uint256 currentWrappedBalance = helpers.balanceOf(wrappedNativeToken(), currentContract);
    
    assert to_mathint(currentNativeBalance) == initNativeBalance + amount;
    assert to_mathint(currentWrappedBalance) == initWrappedBalance - amount;
}

rule unwrapCannotRevertAfterWrap(env e, uint256 amount, uint256 amountToUnwrap)
    good_description "If the call to `wrap` was successful, then `unwrap` should not revert"
{
    require wrappedNativeToken() != helpers.NATIVE_TOKEN();
    require amountToUnwrap > 0;

    uint256[] how = [amountToUnwrap];
    require Authorizer.isAuthorized(e.msg.sender, currentContract, to_bytes4(UNWRAP()), how);

    uint256 wrappedBalanceBefore = helpers.balanceOf(wrappedNativeToken(), currentContract);

    wrap(e, amount);

    uint256 wrappedBalanceAfter = helpers.balanceOf(wrappedNativeToken(), currentContract);
    mathint wrappedAmount = wrappedBalanceAfter - wrappedBalanceBefore;

    unwrap@withrevert(e, amountToUnwrap);
    
    assert to_mathint(amountToUnwrap) <= wrappedAmount => !lastReverted;
}

rule wrapCannotRevertAfterUnwrap(env e, uint256 amount, uint256 amountToWrap)
    good_description "If the call to `unwrap` was successful, then `wrap` should not revert"
{
    require wrappedNativeToken() != helpers.NATIVE_TOKEN();
    require amountToWrap > 0;

    uint256[] how = [amountToWrap];
    require Authorizer.isAuthorized(e.msg.sender, currentContract, to_bytes4(WRAP()), how);

    uint256 wrappedBalanceBefore = helpers.balanceOf(wrappedNativeToken(), currentContract);

    unwrap(e, amount);

    uint256 wrappedBalanceAfter = helpers.balanceOf(wrappedNativeToken(), currentContract);
    mathint unwrappedAmount = wrappedBalanceBefore - wrappedBalanceAfter;

    wrap@withrevert(e, amountToWrap);
    
    assert to_mathint(amountToWrap) <= unwrappedAmount => !lastReverted;
}

rule collectWithdrawIntegrity(env e, address token, address user, uint256 amount)
    good_description "Calling `collect` and then `withdraw` should not change the smart vault balance"
{
    require wrappedNativeToken() != helpers.NATIVE_TOKEN();
    require user != currentContract;
    requireValidFeeCollector();

    uint256 initBalance = helpers.balanceOf(token, currentContract);

    collect(e, token, user, amount);
    withdraw(e, token, user, amount);

    uint256 currentBalance = helpers.balanceOf(token, currentContract);
    assert initBalance == currentBalance;
}

rule withdrawCollectIntegrity(env e, address token, address user, uint256 amount)
    good_description "Calling `withdraw` and then `collect` should not change the smart vault balance"
{
    require wrappedNativeToken() != helpers.NATIVE_TOKEN();
    require user != currentContract;
    requireValidFeeCollector();

    uint256 initBalance = helpers.balanceOf(token, currentContract);

    withdraw(e, token, user, amount);
    collect(e, token, user, amount);

    uint256 currentBalance = helpers.balanceOf(token, currentContract);
    assert initBalance == currentBalance;
}

rule collectProperBalances(env e, address token, address from, uint256 amount)
    good_description "After collecting an `amount` of tokens, the smart vault balance should increase by that `amount`"
{
    require wrappedNativeToken() != helpers.NATIVE_TOKEN();
    require from != currentContract;

    uint256 initBalance = helpers.balanceOf(token, currentContract);

    collect(e, token, from, amount);

    uint256 currentBalance = helpers.balanceOf(token, currentContract);
    assert to_mathint(currentBalance) == initBalance + amount;
}

rule withdrawProperBalances(env e, address token, address recipient, uint256 amount)
    good_description "After withdrawing an `amount` of tokens, the smart vault balance should decrease by that `amount`"
{
    require recipient != currentContract;
    requireValidFeeCollector();

    uint256 initBalance = helpers.balanceOf(token, currentContract);

    withdraw(e, token, recipient, amount);

    uint256 currentBalance = helpers.balanceOf(token, currentContract);
    assert to_mathint(currentBalance) == initBalance - amount;
}

rule withdrawCannotRevertAfterCollect(env e, address token, address user, uint256 amount, uint256 amountToWithdraw)
    good_description "If the call to `collect` was successful, then `withdraw` should not revert"
{
    require user != 0;
    require amountToWithdraw > 0;
    requireValidFeeCollectorWithOverflowCheck(amountToWithdraw, token);

    uint256[] how = helpers.authParams(token, user, amountToWithdraw);
    require Authorizer.isAuthorized(e.msg.sender, currentContract, to_bytes4(WITHDRAW()), how);

    uint256 balanceBefore = helpers.balanceOf(token, currentContract);

    collect(e, token, user, amount);

    uint256 balanceAfter = helpers.balanceOf(token, currentContract);
    mathint collectedAmount = balanceAfter - balanceBefore;

    withdraw@withrevert(e, token, user, amountToWithdraw);
    
    assert to_mathint(amountToWithdraw) <= collectedAmount => !lastReverted;
}

rule collectCannotRevertAfterWithdraw(env e, address token, address user, uint256 amount, uint256 amountToCollect)
    good_description "If the call to `withdraw` was successful, then `collect` should not revert"
{
    require amountToCollect > 0;
    requireValidFeeCollector();

    uint256[] how = [amountToCollect];
    require Authorizer.isAuthorized(e.msg.sender, currentContract, to_bytes4(COLLECT()), how);

    uint256 balanceBefore = helpers.balanceOf(token, currentContract);

    withdraw(e, token, user, amount);

    uint256 balanceAfter = helpers.balanceOf(token, currentContract);
    mathint withdrawnAmount = balanceAfter - balanceBefore;

    collect@withrevert(e, token, user, amountToCollect);
    
    assert to_mathint(amountToCollect) <= withdrawnAmount => !lastReverted;
}

rule executeValidConnector(env e, address connector, bytes data)
    good_description "If the call to `execute` does not revert, then the connector is valid or overridden"
{
    bool isOverridden = isConnectorCheckIgnored(connector);

    execute(e, connector, data);

    assert isOverridden || isValidConnector(connector);
}

rule executeSenderMustBeAuthorized(env e, address connector, bytes data)
    good_description "If the call to `execute` does not revert, then the sender must be authorized"
{
    uint256[] how = helpers.authParams(connector);
    bool isAuthorized = Authorizer.isAuthorized(e.msg.sender, currentContract, to_bytes4(EXECUTE()), how);

    execute(e, connector, data);

    assert isAuthorized;
}

rule callSenderMustBeAuthorized(env e, address target, bytes data, uint256 value)
    good_description "If the call to `call` does not revert, then the sender must be authorized"
{
    uint256[] how = helpers.authParams(target);
    bool isAuthorized = Authorizer.isAuthorized(e.msg.sender, currentContract, to_bytes4(CALL_SIG()), how);

    call(e, target, data, value);

    assert isAuthorized;
}

rule senderMustBeAuthorized(env e, method f, calldataarg args)
    filtered {
        f -> 
            !f.isView
            && !f.isFallback
            && f.selector != INITIALIZE()
    }
    good_description "If the call does not revert, then the sender must be authorized"
{
    address who = e.msg.sender;
    address where = currentContract;
    bytes4 what = to_bytes4(f.selector);

    requireEmptyParams(who, where, what);
    requireEmptyParams(Authorizer.ANYONE(), where, what);
    requireEmptyParams(who, Authorizer.ANYWHERE(), what);
    requireEmptyParams(Authorizer.ANYONE(), Authorizer.ANYWHERE(), what);
    requireNonGenericPermissions(who, where, what);
    
    bool hasPermission = Authorizer.hasPermission(who, where, what);

    f(e, args);

    assert hasPermission;
}
