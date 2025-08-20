const handleLogin = async(e)=>{
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if(!email || !password)
    {
        setError("Please fill all the fields!");
        setLoading(false);
        return;
    }

    try{
        const res = await fetch("",{
            method:"POST",
            headers:{
                "content-type":"application/json"
            },
            body:JSON.stringify({email, password})
        })

        let data;
        try{
            data = res.json();
        }
        catch{
            throw new Error("Server returned invalid json");
        }

        if(!res.ok)
        {
            throw new Error(data.error || "Login failed")
        }

        setSuccess(data.message);
        setEmail("");
        setPassword("");
        localhost.setItem("token", data.token);
        localhost.setItem("user", JSON.stringify(data.user));



    }
}