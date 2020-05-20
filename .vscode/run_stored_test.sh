#!/bin/bash

mix_arg=$( cat $1 )
echo npx mocha $mix_arg
npx mocha $mix_arg
