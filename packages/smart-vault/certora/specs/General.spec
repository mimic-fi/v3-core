// SANITY

rule sanity(method f) good_description "Sanity" {
    env e;
    calldataarg args;
    f(e, args);
    assert false;
}

// REENTRANCY GUARD

ghost uint256 ghostReentrancyStatus;

ghost mathint ghostReentrancyChangedTimes;

hook Sload uint256 status currentContract._status STORAGE {
    require ghostReentrancyStatus == status;
}

hook Sstore currentContract._status uint256 newStatus STORAGE {
    ghostReentrancyChangedTimes = ghostReentrancyChangedTimes + 1;
}

rule 
    reentrancyGuard(env e, method f, calldataarg args) filtered { f -> !f.isView } 
    good_description "Ensure external methods cannot be reentered"
{
    require ghostReentrancyChangedTimes == 0;

    f(e, args);

    bool hasChangedTwice = ghostReentrancyChangedTimes == 2;
    assert hasChangedTwice;
}
