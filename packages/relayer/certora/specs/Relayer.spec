import "./General.spec";

using Helpers as helpers;
using Depositor as Depositor;

/************************************************************/
/*****                    METHODS                       *****/
/************************************************************/

methods {
    // Helpers
    function helpers.NATIVE_TOKEN() external returns (address) envfree => ALWAYS(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    function helpers.balanceOf(address,address) external returns (uint256) envfree;
    function helpers.areValidTasks(address[]) external returns (bool) envfree;

    // Relayer
    function owner() external returns (address) envfree;
    function defaultCollector() external returns (address) envfree;
    function isExecutorAllowed(address) external returns (bool) envfree;
    function getSmartVaultBalance(address) external returns (uint256) envfree;
    function getSmartVaultCollector(address) external returns (address) envfree;
    function getSmartVaultMaxQuota(address) external returns (uint256) envfree;
    function getSmartVaultUsedQuota(address) external returns (uint256) envfree;
    function getApplicableCollector(address) external returns (address) envfree;
    function payTransactionGasToRelayer(address,uint256) external envfree;

    // Wildcard entries
    function _.smartVault() external => PER_CALLEE_CONSTANT;
    function _.hasPermissions(address) external => PER_CALLEE_CONSTANT;
    function _.balanceOf(address) external => DISPATCHER(true);
}


/************************************************************/
/*****                  DEFINITIONS                     *****/
/************************************************************/

// Constants
definition MAX_UINT256() returns mathint = 2^256 - 1;

// Signatures
definition SET_EXECUTOR() returns uint32 = sig:setExecutor(address, bool).selector;
definition SET_DEFAULT_COLLECTOR() returns uint32 = sig:setDefaultCollector(address).selector;
definition SET_SMART_VAULT_COLLECTOR() returns uint32 = sig:setSmartVaultCollector(address, address).selector;
definition SET_SMART_VAULT_MAX_QUOTA() returns uint32 = sig:setSmartVaultMaxQuota(address, uint256).selector;
definition DEPOSIT() returns uint32 = sig:deposit(address, uint256).selector;
definition WITHDRAW() returns uint32 = sig:withdraw(uint256).selector;
definition EXECUTE() returns uint32 = sig:execute(address[], bytes[], bool).selector;
definition SIMULATE() returns uint32 = sig:simulate(address[], bytes[], bool).selector;
definition PAY_TRANSACTION_GAS_TO_RELAYER() returns uint32 = sig:payTransactionGasToRelayer(address, uint256).selector;
definition TRANSFER_OWNERSHIP() returns uint32 = sig:transferOwnership(address).selector;
definition RENOUNCE_OWNERSHIP() returns uint32 = sig:renounceOwnership().selector;


/************************************************************/
/*****                   FUNCTIONS                      *****/
/************************************************************/

function checkBalanceIntegrity(uint32 selector, uint256 initialBalance, uint256 currentBalance) returns bool {
    if (currentBalance > initialBalance) {
        return selector == DEPOSIT();
    }

    if (currentBalance < initialBalance) {
        return selector == EXECUTE() || selector == WITHDRAW();
    }

    return true;
}

function checkUsedQuotaIntegrity(uint32 selector, uint256 initialUsedQuota, uint256 currentUsedQuota) returns bool {
    if (currentUsedQuota > initialUsedQuota) {
        return selector == EXECUTE();
    }

    if (currentUsedQuota < initialUsedQuota) {
        return selector == DEPOSIT();
    }

    return true;
}


/************************************************************/
/*****               GHOSTS AND HOOKS                   *****/
/************************************************************/

ghost uint256 ghostSumOfSmartVaultBalances {
    init_state axiom ghostSumOfSmartVaultBalances == 0;
}

hook Sstore currentContract.getSmartVaultBalance[KEY address smartVault] uint256 newBalance (uint256 oldBalance) STORAGE {
    ghostSumOfSmartVaultBalances = require_uint256(ghostSumOfSmartVaultBalances + newBalance - oldBalance);
}


/************************************************************/
/*****                  INVARIANTS                      *****/
/************************************************************/

invariant contractBalanceIsSumOfBalances()
    ghostSumOfSmartVaultBalances <= helpers.balanceOf(helpers.NATIVE_TOKEN(), currentContract)
    filtered { f -> f.selector != SIMULATE() }
    { preserved with (env e) { require e.msg.sender != currentContract; } }


/************************************************************/
/*****                    RULES                         *****/
/************************************************************/

use rule sanity filtered { f -> f.selector != SIMULATE() }

rule senderIsOwner(env e, method f, calldataarg args)
    filtered {
        f -> 
            !f.isView
            && f.selector != DEPOSIT()
            && f.selector != WITHDRAW()
            && f.selector != EXECUTE()
            && f.selector != SIMULATE()
            && f.selector != PAY_TRANSACTION_GAS_TO_RELAYER()
            && f.selector != TRANSFER_OWNERSHIP()
            && f.selector != RENOUNCE_OWNERSHIP()
    }
    good_description "If the call to `f` doesn't revert, then the sender is the owner"
{
    f(e, args);

    assert e.msg.sender == owner();
}

rule setExecutorOnly(env e, method f, calldataarg args, address executor)
    filtered { 
        f ->
            !f.isView
            && f.selector != SET_EXECUTOR()
            && f.selector != SIMULATE()
    }
    good_description "The only method that can allow/disallow an executor is `setExecutor`"
{
    bool initialExecutorAllowance = isExecutorAllowed(executor);

    f(e, args);

    assert isExecutorAllowed(executor) == initialExecutorAllowance;
}

rule setDefaultCollectorOnly(env e, method f, calldataarg args)
    filtered { 
        f ->
            !f.isView
            && f.selector != SET_DEFAULT_COLLECTOR()
            && f.selector != SIMULATE()
    }
    good_description "The only method that can modify the defaultCollector reference is `setDefaultCollector`"
{
    address initialDefaultCollector = defaultCollector();

    f(e, args);

    assert defaultCollector() == initialDefaultCollector;
}

rule setSmartVaultCollectorOnly(env e, method f, calldataarg args, address smartVault)
    filtered { 
        f ->
            !f.isView
            && f.selector != SET_SMART_VAULT_COLLECTOR()
            && f.selector != SIMULATE()
    }
    good_description "The only method that can modify a smart vault's collector reference is `setSmartVaultCollector`"
{
    address initialSmartVaultCollector = getSmartVaultCollector(smartVault);

    f(e, args);

    assert getSmartVaultCollector(smartVault) == initialSmartVaultCollector;
}

rule setSmartVaultMaxQuotaOnly(env e, method f, calldataarg args, address smartVault)
    filtered { 
        f ->
            !f.isView
            && f.selector != SET_SMART_VAULT_MAX_QUOTA()
            && f.selector != SIMULATE()
    }
    good_description "The only method that can modify a smart vault's maxQuota value is `setSmartVaultMaxQuota`"
{
    uint256 initialSmartVaultMaxQuota = getSmartVaultMaxQuota(smartVault);

    f(e, args);

    assert getSmartVaultMaxQuota(smartVault) == initialSmartVaultMaxQuota;
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
    uint256 initialBalance = getSmartVaultBalance(smartVault);

    f(e, args);

    uint256 currentBalance = getSmartVaultBalance(smartVault);
    assert checkBalanceIntegrity(f.selector, initialBalance, currentBalance);
}

rule smartVaultBalanceCorrectness(env e, method f, calldataarg args, address smartVault, address otherSmartVault)
    filtered { f -> !f.isView && f.selector != SIMULATE() }
    good_description "A method `f` can only modify the balance of at most one smart vault"
{
    require smartVault != otherSmartVault;

    uint256 initialBalance = getSmartVaultBalance(smartVault);
    uint256 initialOtherBalance = getSmartVaultBalance(otherSmartVault);

    f(e, args);

    uint256 currentBalance = getSmartVaultBalance(smartVault);
    uint256 currentOtherBalance = getSmartVaultBalance(otherSmartVault);
    assert initialBalance == currentBalance || initialOtherBalance == currentOtherBalance;
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
    uint256 initialUsedQuota = getSmartVaultUsedQuota(smartVault);

    f(e, args);

    uint256 currentUsedQuota = getSmartVaultUsedQuota(smartVault);
    assert checkUsedQuotaIntegrity(f.selector, initialUsedQuota, currentUsedQuota);
}

rule smartVaultUsedQuotaCorrectness(env e, method f, calldataarg args, address smartVault, address otherSmartVault)
    filtered { f -> !f.isView && f.selector != SIMULATE() }
    good_description "A method `f` can only modify the used quota of at most one smart vault"
{
    require smartVault != otherSmartVault;

    uint256 initialUsedQuota = getSmartVaultUsedQuota(smartVault);
    uint256 initialOtherUsedQuota = getSmartVaultUsedQuota(otherSmartVault);

    f(e, args);

    uint256 currentUsedQuota = getSmartVaultUsedQuota(smartVault);
    uint256 currentOtherUsedQuota = getSmartVaultUsedQuota(otherSmartVault);
    assert initialUsedQuota == currentUsedQuota || initialOtherUsedQuota == currentOtherUsedQuota;
}

rule depositValidAmount(env e, address smartVault, uint256 amount)
    good_description "If the call to `deposit` doesn't revert, then msg.value is equal to `amount`"
{
    deposit(e, smartVault, amount);

    assert e.msg.value == amount;
}

rule depositProperBalances(env e, address smartVault, uint256 amount)
    good_description "After calling `deposit` smart vault, relayer and collector balances are increased properly"
{
    require e.msg.sender != currentContract;

    address collector = getApplicableCollector(smartVault);
    require collector != e.msg.sender;
    require collector != currentContract;

    uint256 initialSmartVaultBalance = getSmartVaultBalance(smartVault);
    uint256 initialRelayerBalance = helpers.balanceOf(helpers.NATIVE_TOKEN(), currentContract);
    uint256 initCollectorBalance = helpers.balanceOf(helpers.NATIVE_TOKEN(), collector);
    uint256 initialUsedQuota = getSmartVaultUsedQuota(smartVault);

    deposit(e, smartVault, amount);

    uint256 currentSmartVaultBalance = getSmartVaultBalance(smartVault);
    uint256 currentRelayerBalance = helpers.balanceOf(helpers.NATIVE_TOKEN(), currentContract);
    uint256 currentCollectorBalance = helpers.balanceOf(helpers.NATIVE_TOKEN(), collector);
    uint256 currentUsedQuota = getSmartVaultUsedQuota(smartVault);
    mathint quotaPaid = initialUsedQuota - currentUsedQuota;

    assert to_mathint(currentSmartVaultBalance) == initialSmartVaultBalance + amount - quotaPaid;
    assert to_mathint(currentRelayerBalance) == initialRelayerBalance + amount - quotaPaid;
    assert to_mathint(currentCollectorBalance) == initCollectorBalance + quotaPaid;
}

rule payQuotaProperBalances(env e, address smartVault, uint256 amount)
    good_description "If a smart vault used quota is lower than amount, then after calling `deposit` its value is 0. Otherwise, it is decreased by amount"
{
    uint256 initialUsedQuota = getSmartVaultUsedQuota(smartVault);

    deposit(e, smartVault, amount);

    uint256 currentUsedQuota = getSmartVaultUsedQuota(smartVault);
    assert to_mathint(currentUsedQuota) == (initialUsedQuota < amount ? 0 : initialUsedQuota - amount);
}

rule withdrawValidAmount(env e, uint256 amount)
    good_description "If the call to `withdraw` doesn't revert, then `amount` was lower than (or equal to) the smart vault balance"
{
    uint256 initialSmartVaultBalance = getSmartVaultBalance(e.msg.sender);

    withdraw(e, amount);

    assert amount <= initialSmartVaultBalance;
}

rule withdrawProperBalances(env e, uint256 amount)
    good_description "After calling `withdraw` the smart vault balance is decreased by `amount`"
{
    uint256 initialSmartVaultBalance = getSmartVaultBalance(e.msg.sender);
    uint256 initialRelayerBalance = helpers.balanceOf(helpers.NATIVE_TOKEN(), currentContract);

    withdraw(e, amount);

    uint256 currentSmartVaultBalance = getSmartVaultBalance(e.msg.sender);
    uint256 currentRelayerBalance = helpers.balanceOf(helpers.NATIVE_TOKEN(), currentContract);

    assert to_mathint(currentSmartVaultBalance) == initialSmartVaultBalance - amount;
    assert to_mathint(currentRelayerBalance) == initialRelayerBalance - amount;
}

rule withdrawIntegrity(env e, uint256 amount)
    good_description "If a smart vault balance is greater than 0, withdrawing at most that amount shouldn't revert"
{
    require e.msg.sender == Depositor;
    require e.msg.value == 0;

    uint256 smartVaultBalance = getSmartVaultBalance(e.msg.sender);
    require amount <= smartVaultBalance;

    uint256 relayerBalance = helpers.balanceOf(helpers.NATIVE_TOKEN(), currentContract);
    require relayerBalance >= amount;

    uint256 senderBalance = helpers.balanceOf(helpers.NATIVE_TOKEN(), e.msg.sender);
    require senderBalance + amount <= MAX_UINT256();

    withdraw@withrevert(e, amount);

    assert !lastReverted;
}

rule executeAllowedExecutor(env e, address[] tasks, bytes[] data, bool continueIfFailed)
    good_description "If the call to `execute` doesn't revert, then the sender is an allowed executor"
{
    bool executorAllowed = isExecutorAllowed(e.msg.sender);

    execute(e, tasks, data, continueIfFailed);

    assert executorAllowed;
}

rule executeValidTasks(env e, address[] tasks, bytes[] data)
    good_description "If the call to `execute` doesn't revert, then all the tasks had permissions over the smart vault and the smart vaults were all the same"
{
    bool areValidTasks = helpers.areValidTasks(tasks);

    bool continueIfFailed = true;
    execute(e, tasks, data, continueIfFailed);

    assert areValidTasks;
}

rule payTransactionGasValidAmount(address smartVault, uint256 amount)
    good_description "If the call to `_payTransactionGasToRelayer` doesn't revert, then the `amount` was lower than (or equal to) the smart vault balance plus its available quota"
{
    uint256 initialBalance = getSmartVaultBalance(smartVault);
    uint256 usedQuota = getSmartVaultUsedQuota(smartVault);
    uint256 maxQuota = getSmartVaultMaxQuota(smartVault);
    uint256 initialAvailableQuota = usedQuota >= maxQuota ? 0 : assert_uint256(maxQuota - usedQuota);

    payTransactionGasToRelayer(smartVault, amount);

    assert to_mathint(amount) <= initialBalance + initialAvailableQuota;
}

rule payTransactionGasProperBalances(address smartVault, uint256 amount)
    good_description "If a smart vault balance is lower than `amount`, then after calling `_payTransactionGasToRelayer` its value is 0 and the used quota grows. Otherwise it is decreased by `amount`"
{
    uint256 initialBalance = getSmartVaultBalance(smartVault);
    uint256 initialUsedQuota = getSmartVaultUsedQuota(smartVault);

    payTransactionGasToRelayer(smartVault, amount);

    uint256 currentBalance = getSmartVaultBalance(smartVault);
    uint256 currentUsedQuota = getSmartVaultUsedQuota(smartVault);

    assert to_mathint(currentBalance) == (initialBalance < amount ? 0 : initialBalance - amount);
    assert to_mathint(currentUsedQuota) == initialUsedQuota + (initialBalance < amount ? amount - initialBalance : 0);
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
    uint256 initialUsedQuota = getSmartVaultUsedQuota(smartVault);
    uint256 maxQuota = getSmartVaultMaxQuota(smartVault);
    require initialUsedQuota <= maxQuota;

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

rule notLockedFunds(env e, method f, calldataarg args, address token)
    filtered { f -> f.selector == EXECUTE() || f.selector == DEPOSIT() || f.selector == WITHDRAW() } 
    good_description "There is always a way to withdraw tokens from the contract"
{
    uint256 initialBalance = helpers.balanceOf(token, currentContract);
    require initialBalance > 0;

    f(e, args);

    uint256 currentBalance = helpers.balanceOf(token, currentContract);
    satisfy currentBalance == 0;
}
