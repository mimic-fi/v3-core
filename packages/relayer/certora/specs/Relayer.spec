import "./General.spec";

using Helpers as helpers;

// METHODS
methods {
    // Helpers
    function helpers.balanceOf(address) external returns (uint256) envfree;

    // Relayer
    function owner() external returns (address) envfree;
    function defaultCollector() external returns (address) envfree;
    function isExecutorAllowed(address) external returns (bool) envfree;
    function getSmartVaultBalance(address) external returns (uint256) envfree;
    function getSmartVaultCollector(address) external returns (address) envfree;
    function getSmartVaultMaxQuota(address) external returns (uint256) envfree;
    function getSmartVaultUsedQuota(address) external returns (uint256) envfree;
    function payTransactionGasToRelayer(address,uint256) external envfree;
}

// DEFINITIONS
definition SET_EXECUTOR() returns uint32 = sig:setExecutor(address, bool).selector;
definition SET_DEFAULT_COLLECTOR() returns uint32 = sig:setDefaultCollector(address).selector;
definition SET_SMART_VAULT_COLLECTOR() returns uint32 = sig:setSmartVaultCollector(address, address).selector;
definition SET_SMART_VAULT_MAX_QUOTA() returns uint32 = sig:setSmartVaultMaxQuota(address, uint256).selector;
definition DEPOSIT() returns uint32 = sig:deposit(address, uint256).selector;
definition WITHDRAW() returns uint32 = sig:withdraw(uint256).selector;
definition EXECUTE() returns uint32 = sig:execute(address[], bytes[], bool).selector;
definition SIMULATE() returns uint32 = sig:simulate(address[], bytes[], bool).selector;
definition RESCUE_FUNDS() returns uint32 = sig:rescueFunds(address, address, uint256).selector;
definition PAY_TRANSACTION_GAS_TO_RELAYER() returns uint32 = sig:payTransactionGasToRelayer(address, uint256).selector;

// FUNCTIONS
function checkBalanceIntegrity(uint32 selector, uint256 initBalance, uint256 currentBalance) returns bool {
    if (currentBalance > initBalance) {
        return selector == DEPOSIT();
    }

    if (currentBalance < initBalance) {
        return selector == EXECUTE() || selector == WITHDRAW();
    }

    return true;
}

function checkUsedQuotaIntegrity(uint32 selector, uint256 initUsedQuota, uint256 currentUsedQuota) returns bool {
    if (currentUsedQuota > initUsedQuota) {
        return selector == EXECUTE();
    }

    if (currentUsedQuota < initUsedQuota) {
        return selector == DEPOSIT();
    }

    return true;
}

// GHOSTS AND HOOKS
ghost uint256 callOutput;

hook CALL(uint g, address addr, uint value, uint argsOffset, uint argsLength, uint retOffset, uint retLength) uint rc {
    callOutput = rc;
}

// RULES
use rule sanity filtered { f -> f.selector != SIMULATE() }

rule senderIsOwner(env e, method f, calldataarg args)
    filtered {
        f -> 
            f.selector == SET_EXECUTOR()
            || f.selector == SET_DEFAULT_COLLECTOR()
            || f.selector == SET_SMART_VAULT_COLLECTOR()
            || f.selector == SET_SMART_VAULT_MAX_QUOTA()
            || f.selector == RESCUE_FUNDS()
    }
    good_description "If the call to `f` doesn't revert, then the sender is the owner"
{
    f(e, args);

    assert e.msg.sender == owner();
}

rule setExecutorOnly(env e, method f, calldataarg args, address executor)
    filtered { 
        f -> !f.isView
        && f.selector != SET_EXECUTOR()
        && f.selector != SIMULATE()
    }
    good_description "The only method that can allow/disallow an executor is `setExecutor`"
{
    bool initExecutorAllowance = isExecutorAllowed(executor);

    f(e, args);

    assert isExecutorAllowed(executor) == initExecutorAllowance;
}

rule setDefaultCollectorOnly(env e, method f, calldataarg args)
    filtered { 
        f -> !f.isView
        && f.selector != SET_DEFAULT_COLLECTOR()
        && f.selector != SIMULATE()
    }
    good_description "The only method that can modify the defaultCollector reference is `setDefaultCollector`"
{
    address initDefaultCollector = defaultCollector();

    f(e, args);

    assert defaultCollector() == initDefaultCollector;
}

rule setSmartVaultCollectorOnly(env e, method f, calldataarg args, address smartVault)
    filtered { 
        f -> !f.isView
        && f.selector != SET_SMART_VAULT_COLLECTOR()
        && f.selector != SIMULATE()
    }
    good_description "The only method that can modify a smart vault's collector reference is `setSmartVaultCollector`"
{
    address initSmartVaultCollector = getSmartVaultCollector(smartVault);

    f(e, args);

    assert getSmartVaultCollector(smartVault) == initSmartVaultCollector;
}

rule setSmartVaultMaxQuotaOnly(env e, method f, calldataarg args, address smartVault)
    filtered { 
        f -> !f.isView
        && f.selector != SET_SMART_VAULT_MAX_QUOTA()
        && f.selector != SIMULATE()
    }
    good_description "The only method that can modify a smart vault's maxQuota value is `setSmartVaultMaxQuota`"
{
    uint256 initSmartVaultMaxQuota = getSmartVaultMaxQuota(smartVault);

    f(e, args);

    assert getSmartVaultMaxQuota(smartVault) == initSmartVaultMaxQuota;
}

rule smartVaultBalanceIntegrity(env e, method f, calldataarg args, address smartVault)
    filtered {
        f ->
            !f.isView
            && f.selector != SIMULATE()
            && f.selector != PAY_TRANSACTION_GAS_TO_RELAYER()
    }
    good_description "A smart vault balance can only be increased by `deposit` and decreased by `execute` or `withdraw`"
{
    uint256 initBalance = getSmartVaultBalance(smartVault);

    f(e, args);

    uint256 currentBalance = getSmartVaultBalance(smartVault);
    assert checkBalanceIntegrity(f.selector, initBalance, currentBalance);
}

rule smartVaultBalanceCorrectness(env e, method f, calldataarg args, address smartVault, address otherSmartVault)
    filtered { f -> !f.isView && f.selector != SIMULATE() }
    good_description "A method `f` can only modify the balance of at most one smart vault"
{
    require smartVault != otherSmartVault;

    uint256 initBalance = getSmartVaultBalance(smartVault);
    uint256 initOtherBalance = getSmartVaultBalance(otherSmartVault);

    f(e, args);

    uint256 currentBalance = getSmartVaultBalance(smartVault);
    uint256 currentOtherBalance = getSmartVaultBalance(otherSmartVault);
    assert initBalance == currentBalance || initOtherBalance == currentOtherBalance;
}

rule smartVaultUsedQuotaIntegrity(env e, method f, calldataarg args, address smartVault)
    filtered {
        f ->
            !f.isView
            && f.selector != SIMULATE()
            && f.selector != PAY_TRANSACTION_GAS_TO_RELAYER()
    }
    good_description "A smart vault used quota can only be increased by `execute` and decreased by `deposit`"
{
    uint256 initUsedQuota = getSmartVaultUsedQuota(smartVault);

    f(e, args);

    uint256 currentUsedQuota = getSmartVaultUsedQuota(smartVault);
    assert checkUsedQuotaIntegrity(f.selector, initUsedQuota, currentUsedQuota);
}

rule smartVaultUsedQuotaCorrectness(env e, method f, calldataarg args, address smartVault, address otherSmartVault)
    filtered { f -> !f.isView && f.selector != SIMULATE() }
    good_description "A method `f` can only modify the used quota of at most one smart vault"
{
    require smartVault != otherSmartVault;

    uint256 initUsedQuota = getSmartVaultUsedQuota(smartVault);
    uint256 initOtherUsedQuota = getSmartVaultUsedQuota(otherSmartVault);

    f(e, args);

    uint256 currentUsedQuota = getSmartVaultUsedQuota(smartVault);
    uint256 currentOtherUsedQuota = getSmartVaultUsedQuota(otherSmartVault);
    assert initUsedQuota == currentUsedQuota || initOtherUsedQuota == currentOtherUsedQuota;
}

rule depositValidAmount(env e, address smartVault, uint256 amount)
    good_description "If the call to `deposit` doesn't revert, then msg.value is equal to `amount`"
{
    deposit(e, smartVault, amount);

    assert e.msg.value == amount;
}

rule depositProperBalances(env e, address smartVault, uint256 amount)
    good_description "After calling `deposit` the smart vault balance is increased at most by `amount`"
{
    uint256 initSmartVaultBalance = getSmartVaultBalance(smartVault);
    uint256 initRelayerBalance = helpers.balanceOf(currentContract);

    deposit(e, smartVault, amount);

    uint256 currentSmartVaultBalance = getSmartVaultBalance(smartVault);
    uint256 currentRelayerBalance = helpers.balanceOf(currentContract);

    assert to_mathint(currentSmartVaultBalance) <= initSmartVaultBalance + amount;
    assert to_mathint(currentRelayerBalance) == initRelayerBalance + (e.msg.sender == currentContract ? 0 : amount);
}

rule payQuotaProperBalances(env e, address smartVault, uint256 amount)
    good_description "If a smart vault used quota is lower than amount, then after calling `deposit` its value is 0. Otherwise, it is decreased by amount"
{
    uint256 initUsedQuota = getSmartVaultUsedQuota(smartVault);

    deposit(e, smartVault, amount);

    uint256 currentUsedQuota = getSmartVaultUsedQuota(smartVault);
    assert to_mathint(currentUsedQuota) == (initUsedQuota < amount ? 0 : initUsedQuota - amount);
}

rule withdrawValidAmount(env e, uint256 amount)
    good_description "If the call to `withdraw` doesn't revert, then `amount` was lower than (or equal to) the smart vault balance"
{
    uint256 initSmartVaultBalance = getSmartVaultBalance(e.msg.sender);

    withdraw(e, amount);

    assert amount <= initSmartVaultBalance;
}

rule withdrawProperBalances(env e, uint256 amount)
    good_description "After calling `withdraw` the smart vault balance is decreased by `amount`"
{
    uint256 initSmartVaultBalance = getSmartVaultBalance(e.msg.sender);
    uint256 initRelayerBalance = helpers.balanceOf(currentContract);

    withdraw(e, amount);

    uint256 currentSmartVaultBalance = getSmartVaultBalance(e.msg.sender);
    uint256 currentRelayerBalance = helpers.balanceOf(currentContract);

    assert to_mathint(currentSmartVaultBalance) == initSmartVaultBalance - amount;
    assert to_mathint(currentRelayerBalance) == initRelayerBalance - amount;
}

rule withdrawIntegrity(env e, uint256 amount)
    good_description "If a smart vault balance is greater than 0, withdrawing at most that amount shouldn't revert"
{
    require callOutput == 0;

    uint256 balance = getSmartVaultBalance(e.msg.sender);
    require amount <= balance;

    withdraw@withrevert(e, amount);

    require callOutput == 1;

    assert !lastReverted;
}

rule executeAllowedExecutor(env e, address[] tasks, bytes[] data, bool continueIfFailed)
    good_description "If the call to `execute` doesn't revert, then the sender is an allowed executor"
{
    bool executorAllowed = isExecutorAllowed(e.msg.sender);

    execute(e, tasks, data, continueIfFailed);

    assert executorAllowed;
}

rule payTransactionGasValidAmount(address smartVault, uint256 amount)
    good_description "If the call to `_payTransactionGasToRelayer` doesn't revert, then the `amount` was lower than (or equal to) the smart vault balance plus its available quota"
{
    uint256 initBalance = getSmartVaultBalance(smartVault);
    uint256 usedQuota = getSmartVaultUsedQuota(smartVault);
    uint256 maxQuota = getSmartVaultMaxQuota(smartVault);
    uint256 initAvailableQuota = usedQuota >= maxQuota ? 0 : assert_uint256(maxQuota - usedQuota);

    payTransactionGasToRelayer(smartVault, amount);

    assert to_mathint(amount) <= initBalance + initAvailableQuota;
}

rule payTransactionGasProperBalances(address smartVault, uint256 amount)
    good_description "If a smart vault balance is lower than `amount`, then after calling `_payTransactionGasToRelayer` its value is 0 and the used quota grows. Otherwise it is decreased by `amount`"
{
    uint256 initBalance = getSmartVaultBalance(smartVault);
    uint256 initUsedQuota = getSmartVaultUsedQuota(smartVault);

    payTransactionGasToRelayer(smartVault, amount);

    uint256 currentBalance = getSmartVaultBalance(smartVault);
    uint256 currentUsedQuota = getSmartVaultUsedQuota(smartVault);

    assert to_mathint(currentBalance) == (initBalance < amount ? 0 : initBalance - amount);
    assert to_mathint(currentUsedQuota) == initUsedQuota + (initBalance < amount ? amount - initBalance : 0);
}

rule maxQuotaCorrectness(env e, address smartVault, uint256 amount)
    good_description "If a smart vault max quota is decreased below its used quota, then calling `_payTransactionGasToRelayer` should revert in case the smart vault has insufficient balance"
{
    uint256 initBalance = getSmartVaultBalance(smartVault);

    uint256 usedQuota = getSmartVaultUsedQuota(smartVault);
    uint256 newMaxQuota = require_uint256(usedQuota - 1);
    setSmartVaultMaxQuota(e, smartVault, newMaxQuota);

    payTransactionGasToRelayer@withrevert(smartVault, amount);

    assert initBalance < amount => lastReverted;
}

rule maxQuotaIntegrity(env e, method f, calldataarg args, address smartVault)
    filtered {
        f -> 
            !f.isView
            && f.selector != SET_SMART_VAULT_MAX_QUOTA()
            && f.selector != SIMULATE()
    }
    good_description "If a smart vault used quota is lower than (or equal to) its max quota, then after calling `f` it should remain being lower"
{
    uint256 initUsedQuota = getSmartVaultUsedQuota(smartVault);
    uint256 maxQuota = getSmartVaultMaxQuota(smartVault);
    require initUsedQuota <= maxQuota;

    f(e, args);

    uint256 currentUsedQuota = getSmartVaultUsedQuota(smartVault);
    assert currentUsedQuota <= maxQuota;
}

rule simulateAlwaysReverts(env e, address[] tasks, bytes[] data, bool continueIfFailed)
    good_description "Calling `simulate` always reverts"
{
    simulate@withrevert(e, tasks, data, continueIfFailed);

    assert lastReverted;
}
