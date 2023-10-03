rule sanity(method f) good_description "Sanity" {
    env e;
    calldataarg args;
    f(e, args);
    assert false;
}
