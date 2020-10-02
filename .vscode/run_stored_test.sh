#!/bin/bash

mix_arg=$( cat $1 )
echo npx ts-node $mix_arg
npx ts-node $mix_arg
